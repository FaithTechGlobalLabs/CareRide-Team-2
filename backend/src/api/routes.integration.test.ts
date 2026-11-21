import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { Server } from "node:http";

import { PostgreSqlContainer } from "@testcontainers/postgresql";
import express from "express";
import jwt from "jsonwebtoken";
import { Kysely, PostgresDialect, sql } from "kysely";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
} from "vitest";

import type {
  IPushTransport,
  PushMessage,
  PushOutcome,
} from "../application/ports/pushDeliveries.js";
import type {
  DatabaseClient,
  DatabaseSchema,
} from "../infrastructure/persistence/databaseClient.js";

import { migratePostgresTestDatabase } from "../../test/postgresTestDatabase.js";
import {
  POSTGRES_IMAGE,
  TEST_DATABASE_NAME,
} from "../../test/postgresTestDatabaseConfig.js";
import { NotificationContainer } from "../infrastructure/notificationContainer.js";
import { createBookingNotificationHandler } from "../presentation/notifications/bookingNotificationHandler.js";
import { driverNotificationFixture } from "./routes.integration.fixtures.js";
import { registerApi } from "./routes.js";

let postgresContainer: StartedPostgreSqlContainer | undefined;
let database: DatabaseClient;
let pool: Pool;
let fixture: Awaited<ReturnType<typeof driverNotificationFixture>>;
let server: Server | undefined;
let origin: string;
const sent: { endpoint: string; message: PushMessage }[] = [];
let send: IPushTransport["send"];
let notifications: NotificationContainer;
let tasks: Promise<unknown>[];
let configured = true;

beforeAll(async () => {
  postgresContainer = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withPlatform("linux/amd64")
    .withDatabase(TEST_DATABASE_NAME)
    .withUsername("careride_test")
    .withPassword(randomBytes(24).toString("base64url"))
    .withStartupTimeout(120_000)
    .start();
  pool = new Pool({
    connectionString: postgresContainer.getConnectionUri(),
    max: 10,
  });
  database = new Kysely<DatabaseSchema>({
    dialect: new PostgresDialect({ pool }),
  });
  await migratePostgresTestDatabase(database);
});
beforeEach(async () => {
  fixture = await driverNotificationFixture(database);
  tasks = [];
  sent.length = 0;
  configured = true;
  send = async (subscription, message) => {
    sent.push({ endpoint: subscription.endpoint, message });
    return { kind: "sent" };
  };
  notifications = new NotificationContainer(database, {
    get configured() {
      return configured;
    },
    send: (subscription, message) => send(subscription, message),
  });
  const app = express();
  app.use(express.json());
  registerApi(app, {
    databasePool: pool,
    notifyBooking: createBookingNotificationHandler(
      notifications.bookingNotificationsService,
      (task) => {
        tasks.push(task);
      }
    ),
    dispatchPush: notifications.dispatch,
  });
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res
        .status(500)
        .json({ message: error instanceof Error ? error.message : "Error" });
    }
  );
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test port");
  origin = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  await Promise.all(tasks);
  await new Promise<void>((resolve) => {
    server?.close(() => resolve());
  });
  await fixture.cleanup();
});
afterAll(async () => {
  try {
    await database?.destroy();
  } finally {
    await postgresContainer?.stop();
  }
});

async function call(
  path: string,
  kind: "staff" | "driver",
  id: string,
  body?: unknown
) {
  const token = jwt.sign(
    { sub: id, kind, role: kind, organizationId: fixture.org },
    process.env.JWT_SECRET || "careride-dev-secret"
  );
  return fetch(origin + path, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function bookAndExpect201(body = fixture.body) {
  const response = await call("/rides", "staff", fixture.staff, body);
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(
    201
  );
  const payload: { rides: { id: string }[] } = await response.json();
  return payload.rides.map((ride) => ride.id);
}

test("commits a round trip and returns 201 before push completes, with one notice per eligible driver", async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  send = async (subscription, message) => {
    await pending;
    sent.push({ endpoint: subscription.endpoint, message });
    return { kind: "sent" };
  };
  try {
    const ids = await bookAndExpect201();
    expect(ids).toHaveLength(2);
    expect(tasks).toHaveLength(1);
    expect(sent).toHaveLength(0);
  } finally {
    finish();
  }
  await Promise.all(tasks);
  const notices = await sql<{
    driver_id: string;
    action_url: string;
    title: string;
    message: string;
  }>`SELECT driver_id,action_url,title,message FROM notifications WHERE driver_id = ANY(${fixture.drivers}::uuid[])`.execute(
    database
  );
  expect(notices.rows.map((row) => row.driver_id).toSorted()).toEqual(
    fixture.drivers.slice(0, 2).toSorted()
  );
  expect(
    notices.rows.every(
      (row) =>
        row.action_url === "/driver" &&
        row.title === "A ride fits your availability" &&
        row.message === "Open available rides to view pickup times and details."
    )
  ).toBe(true);
  expect(sent).toHaveLength(1);
  expect(sent[0]?.message).toMatchObject({
    title: "CareRide",
    url: "/driver",
    body: "A ride fits your availability. Tap to view available rides.",
  });
});

test("targeted delivery leaves staff backlog alone; global dispatch preserves staff content and does not repeat driver success", async () => {
  await sql`INSERT INTO notification_preferences (user_id,kind,push_enabled) VALUES (${fixture.staff},'staff',true)`.execute(
    database
  );
  await sql`INSERT INTO push_subscriptions (endpoint,user_id,kind,p256dh,auth) VALUES ('https://push.example.test/staff',${fixture.staff},'staff','key','auth')`.execute(
    database
  );
  await bookAndExpect201();
  await Promise.all(tasks);
  expect(sent.every((item) => item.message.url === "/driver")).toBe(true);
  const driverSent = sent.length;
  await notifications.dispatch();
  expect(sent.filter((item) => item.message.url === "/driver")).toHaveLength(
    driverSent
  );
  expect(
    sent.filter((item) => item.message.url === "/notifications")
  ).toHaveLength(2);
  expect(
    sent.find((item) => item.message.url === "/notifications")?.message.body
  ).toBe(
    "There is an update for your organization. Open CareRide for details."
  );
});

test("a driver matching only the return leg still gets one notice and missing preferences use inbox defaults", async () => {
  await sql`UPDATE driver_availabilities SET start_time = '13:00' WHERE driver_id = ${fixture.drivers[0]}`.execute(
    database
  );
  await sql`DELETE FROM notification_preferences WHERE user_id = ${fixture.drivers[1]}`.execute(
    database
  );
  await bookAndExpect201();
  await Promise.all(tasks);
  const rows =
    await sql`SELECT id FROM notifications WHERE driver_id = ANY(${fixture.drivers.slice(0, 2)}::uuid[])`.execute(
      database
    );
  expect(rows.rows).toHaveLength(2);
  expect(sent).toHaveLength(1);
});

test.each(["approval", "capacity", "wheelchair", "radius", "time"])(
  "does not notify a driver rejected by %s eligibility",
  async (reason) => {
    const driver = fixture.drivers[0]!;
    if (reason === "approval")
      await sql`UPDATE driver_verifications SET expires_on = CURRENT_DATE - 1 WHERE driver_id = ${driver}`.execute(
        database
      );
    if (reason === "capacity")
      await sql`UPDATE vehicles SET seats = 1 WHERE driver_id = ${driver}`.execute(
        database
      );
    if (reason === "wheelchair")
      fixture.body = { ...fixture.body, accessibility_needs: ["wheelchair"] };
    if (reason === "radius")
      await sql`UPDATE driver_availabilities SET radius_m = 1, centre = ST_SetSRID(ST_MakePoint(0,0),4326)::geography WHERE driver_id = ${driver}`.execute(
        database
      );
    if (reason === "time")
      await sql`UPDATE driver_availabilities SET start_time = '17:00' WHERE driver_id = ${driver}`.execute(
        database
      );
    await bookAndExpect201();
    await Promise.all(tasks);
    expect(sent).toHaveLength(0);
  }
);

test("two drivers racing to accept one ride produce one winner and one conflict", async () => {
  const ids = await bookAndExpect201({ ...fixture.body, trip_type: "one_way" });
  await Promise.all(tasks);
  const responses = await Promise.all(
    fixture.drivers
      .slice(0, 2)
      .map((id) => call(`/rides/${ids[0]}/accept`, "driver", id))
  );
  expect(
    responses.map((response) => response.status).toSorted((a, b) => a - b)
  ).toEqual([200, 409]);
  const dispatch =
    await sql`SELECT driver_id FROM dispatches WHERE ride_request_id = ${ids[0]} AND response = 'accepted'`.execute(
      database
    );
  expect(dispatch.rows).toHaveLength(1);
});

test("invalid booking does not schedule a task or create a partial ride", async () => {
  const response = await call("/rides", "staff", fixture.staff, {
    ...fixture.body,
    destination_id: fixture.client,
  });
  expect(response.status).toBe(400);
  expect(tasks).toHaveLength(0);
  const rides =
    await sql`SELECT id FROM ride_requests WHERE organization_id = ${fixture.org}`.execute(
      database
    );
  expect(rides.rows).toHaveLength(0);
});

test("concurrent bookings keep their own targeted notifications", async () => {
  await Promise.all([bookAndExpect201(), bookAndExpect201()]);
  await Promise.all(tasks);
  expect(tasks).toHaveLength(2);
  expect(sent).toHaveLength(2);
  expect(new Set(sent.map((item) => item.message.tag)).size).toBe(2);
});

test("one targeted pass reaches more than the global dispatcher's forty-device limit", async () => {
  await sql`INSERT INTO push_subscriptions (endpoint,user_id,kind,p256dh,auth)
    SELECT 'https://push.example.test/extra-' || n, ${fixture.drivers[0]}, 'driver', 'key', 'auth'
    FROM generate_series(1,45) n`.execute(database);
  await bookAndExpect201();
  await Promise.all(tasks);
  expect(sent).toHaveLength(46);
});

test("missing push configuration still creates inbox notices", async () => {
  configured = false;
  await bookAndExpect201();
  await Promise.all(tasks);
  expect(sent).toHaveLength(0);
  const notices =
    await sql`SELECT id FROM notifications WHERE driver_id = ANY(${fixture.drivers}::uuid[])`.execute(
      database
    );
  expect(notices.rows).toHaveLength(2);
});

test("provider failure keeps the booking and records outcomes without retrying; expired subscriptions are pruned", async () => {
  await sql`INSERT INTO push_subscriptions (endpoint,user_id,kind,p256dh,auth)
    VALUES ('https://push.example.test/gone',${fixture.drivers[0]},'driver','key','auth')`.execute(
    database
  );
  const attempts: string[] = [];
  send = async (subscription): Promise<PushOutcome> => {
    attempts.push(subscription.endpoint);
    return subscription.endpoint.endsWith("/gone")
      ? { kind: "gone", status: 410 }
      : { kind: "transient", status: 503 };
  };
  await bookAndExpect201();
  await Promise.all(tasks);
  expect(attempts).toHaveLength(2);
  const remaining =
    await sql`SELECT endpoint FROM push_subscriptions WHERE endpoint = 'https://push.example.test/gone'`.execute(
      database
    );
  expect(remaining.rows).toHaveLength(0);
  const outcomes = await sql<{
    attempts: number;
    delivered_at: Date | null;
  }>`SELECT attempts, delivered_at FROM push_deliveries WHERE endpoint = ${attempts.find((endpoint) => !endpoint.endsWith("/gone"))}`.execute(
    database
  );
  expect(outcomes.rows).toEqual([{ attempts: 1, delivered_at: null }]);
});

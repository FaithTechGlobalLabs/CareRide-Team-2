import assert from "node:assert/strict";
import test, { before, after, beforeEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import webpush from "web-push";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "careride-personal-"));
process.env.CARERIDE_DATA_DIR = directory;
process.env.JWT_SECRET = "isolated-test-only";
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;
delete process.env.VAPID_SUBJECT;
const { registerApi } = await import("../src/api/routes.ts");
const { readDb, update, setPushDispatcher } =
  await import("../src/store/jsonStore.ts");
const { flushPush } = await import("../src/notifications/push.ts");
const hash = await bcrypt.hash("fixture-password", 4);
let server, origin;
const pickup = new Date(Date.now() + 2 * 86400000).toISOString();
function fixture() {
  return {
    organizations: [
      {
        id: "org",
        name: "Fixture Community",
        status: "active",
        type: "partner_org",
      },
      { id: "other", name: "Other", status: "active" },
    ],
    staff: ["staff", "colleague", "outsider"].map((id) => ({
      id,
      name: id,
      organization_id: id === "outsider" ? "other" : "org",
      email: `${id}@example.test`,
      role: "staff",
      is_active: true,
      password_hash: hash,
    })),
    drivers: ["driver", "unapproved"].map((id) => ({
      id,
      name: id,
      password_hash: hash,
      email: `${id}@example.test`,
    })),
    clients: [
      {
        id: "client",
        organization_id: "org",
        first_name: "Test",
        last_name: "Client",
      },
    ],
    destinations: [{ id: "location", organization_id: "org", name: "Clinic" }],
    rides: [
      {
        id: "ride",
        client_id: "client",
        organization_id: "org",
        requested_by_user_id: "staff",
        pickup_lat: 49.28,
        pickup_lng: -123.12,
        requested_pickup_at: pickup,
        updated_at: "2026-01-01T00:00:00.000Z",
        status: "requested",
        passenger_count: 1,
        destination_id: "location",
      },
    ],
    vehicles: ["driver", "unapproved"].map((id) => ({
      id: `vehicle-${id}`,
      driver_id: id,
      seats: 4,
      wheelchair_accessible: false,
    })),
    availabilities: ["driver", "unapproved"].map((id) => ({
      id: `availability-${id}`,
      driver_id: id,
      centre_lat: 49.28,
      centre_lng: -123.12,
      radius_km: 20,
      is_active: true,
      kind: "weekly",
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      start_time: "00:00",
      end_time: "23:59",
    })),
    verifications: [
      {
        id: "verification",
        driver_id: "driver",
        approved_by_org_id: "org",
        status: "approved",
        check_type: "identity",
      },
    ],
    notifications: [],
  };
}
function token(id, kind = "staff", org = "org") {
  return jwt.sign(
    { sub: id, kind, role: kind, organizationId: org },
    process.env.JWT_SECRET,
  );
}
async function call(
  url,
  method = "GET",
  body,
  id = "staff",
  kind = "staff",
  org = "org",
) {
  const response = await fetch(origin + url, {
    method,
    headers: {
      Authorization: `Bearer ${token(id, kind, org)}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}
before(async () => {
  const app = express();
  app.use(express.json());
  registerApi(app);
  app.use((error, req, res, next) =>
    res.status(500).json({ message: String(error) }),
  );
  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", (error) =>
      error ? reject(error) : resolve(),
    );
  });
  origin = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  setPushDispatcher(async () => {});
  fs.writeFileSync(
    path.join(directory, "store.json"),
    JSON.stringify(fixture()),
  );
});
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  fs.rmSync(directory, { recursive: true, force: true });
});

test("notifications are scoped, eligible, deduplicated, and include client updates", async () => {
  await update((db) => {
    db.rides[0].status = "accepted";
    db.rides[0].driver_id = "driver";
  });
  assert.deepEqual(
    readDb()
      .notifications.map((n) => n.recipient_user_id)
      .sort(),
    ["colleague", "staff"],
  );
  await update((db) => {
    db.rides[0].status = "requested";
    delete db.rides[0].driver_id;
    db.rides[0].updated_at = new Date().toISOString();
  });
  assert.equal(
    readDb().notifications.filter((n) => n.type === "available_ride").length,
    1,
  );
  const count = readDb().notifications.length;
  await update(() => {});
  assert.equal(readDb().notifications.length, count);
  await update((db) => {
    db.clients[0].first_name = "Updated";
  });
  assert.equal(
    readDb().notifications.filter((n) => n.type === "client_updated").length,
    2,
  );
  const driverNotes = await call(
    "/notifications",
    "GET",
    undefined,
    "driver",
    "driver",
  );
  assert.equal(driverNotes.status, 200);
  assert.equal(driverNotes.body.notifications.length, 1);
  assert.equal(
    (
      await call(
        `/notifications/${driverNotes.body.notifications[0].id}/read`,
        "POST",
        {},
      )
    ).status,
    404,
  );
});

test("round trips show both open legs and accepting either leg leaves the other available", async () => {
  await update(db => {
    db.rides[0].linked_ride_id = "return";
    db.rides[0].trip_group_id = "trip";
    db.rides[0].trip_leg = "outbound";
    db.rides.push({ ...db.rides[0], id: "return", linked_ride_id: "ride", trip_leg: "return" });
  });
  let available = await call("/drivers/me/rides/available", "GET", undefined, "driver", "driver");
  assert.deepEqual(available.body.rides.map(r => r.id).sort(), ["return", "ride"]);
  assert.equal((await call("/rides/return/accept", "POST", {}, "driver", "driver")).status, 200);
  available = await call("/drivers/me/rides/available", "GET", undefined, "driver", "driver");
  assert.deepEqual(available.body.rides.map(r => r.id), ["ride"]);
  assert.equal(available.body.rides[0].linked_leg_status, "accepted");
  const assigned = await call("/drivers/me/rides", "GET", undefined, "driver", "driver");
  assert.deepEqual(assigned.body.rides.map(r => r.id), ["return"]);
});

test("preferences wait a day, persist later/decline, and unsubscribe is scoped", async () => {
  const first = await call(
    "/notifications/preferences",
    "GET",
    undefined,
    "driver",
    "driver",
  );
  assert.ok(
    new Date(first.body.preferences.prompt_after).getTime() >
      Date.now() + 23 * 3600000,
  );
  const later = await call(
    "/notifications/preferences",
    "PATCH",
    { prompt: "later" },
    "driver",
    "driver",
  );
  assert.ok(
    new Date(later.body.preferences.prompt_after).getTime() >
      Date.now() + 6 * 86400000,
  );
  const declined = await call(
    "/notifications/preferences",
    "PATCH",
    { prompt: "declined" },
    "driver",
    "driver",
  );
  assert.equal(declined.body.preferences.prompt_dismissed, true);
  await update((db) => {
    db.pushSubscriptions = [
      { user_id: "driver", kind: "driver", endpoint: "https://example.test" },
    ];
  });
  await call("/notifications/subscriptions", "DELETE", {});
  assert.equal(readDb().pushSubscriptions.length, 1);
});

test("driver deletion requires exact text and password, releases rides, and revokes tokens", async () => {
  await update((db) => {
    db.rides[0].status = "accepted";
    db.rides[0].driver_id = "driver";
  });
  assert.equal(
    (
      await call(
        "/settings/account",
        "DELETE",
        { confirmation: "delete", password: "fixture-password" },
        "driver",
        "driver",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/settings/account",
        "DELETE",
        { confirmation: "DELETE", password: "wrong" },
        "driver",
        "driver",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/settings/account",
        "DELETE",
        { confirmation: "DELETE", password: "fixture-password" },
        "driver",
        "driver",
      )
    ).status,
    200,
  );
  const db = readDb();
  assert.equal(
    db.drivers.some((d) => d.id === "driver"),
    false,
  );
  assert.equal(db.rides[0].status, "requested");
  assert.equal(db.rides[0].driver_id, undefined);
  assert.equal(
    db.vehicles.some((v) => v.driver_id === "driver"),
    false,
  );
  assert.equal(
    (await call("/notifications", "GET", undefined, "driver", "driver")).status,
    401,
  );
});

test("first acceptance offers a gentle prompt once and respects an earlier snooze", async () => {
  await update((db) => {
    db.rides[0].status = "accepted";
    db.rides[0].driver_id = "driver";
  });
  let prefs = (
    await call(
      "/notifications/preferences",
      "GET",
      undefined,
      "driver",
      "driver",
    )
  ).body.preferences;
  assert.equal(prefs.first_ride_prompt_pending, true);
  await call(
    "/notifications/preferences",
    "PATCH",
    { prompt: "later" },
    "driver",
    "driver",
  );
  await update((db) => {
    db.rides[0].status = "requested";
    delete db.rides[0].driver_id;
  });
  await update((db) => {
    db.rides[0].status = "accepted";
    db.rides[0].driver_id = "driver";
  });
  prefs = (
    await call(
      "/notifications/preferences",
      "GET",
      undefined,
      "driver",
      "driver",
    )
  ).body.preferences;
  assert.equal(prefs.first_ride_prompt_pending, false);
});

test("active rides block deletion and staff account deletion preserves organization data", async () => {
  await update((db) => {
    db.rides[0].status = "in_progress";
    db.rides[0].driver_id = "driver";
  });
  assert.equal(
    (
      await call(
        "/settings/account",
        "DELETE",
        { confirmation: "DELETE", password: "fixture-password" },
        "driver",
        "driver",
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await call("/settings/account", "DELETE", {
        confirmation: "DELETE",
        password: "fixture-password",
      })
    ).status,
    200,
  );
  assert.equal(readDb().clients.length, 1);
  assert.equal(readDb().organizations.length, 2);
  assert.equal((await call("/notifications")).status, 401);
});

test("any active staff can delete only their own organization with stronger confirmation", async () => {
  const body = {
    confirmation: "DELETE ORGANIZATION",
    password: "fixture-password",
    organization_name: "Fixture Community",
    acknowledged: true,
  };
  assert.equal(
    (await call("/settings/organization", "DELETE", body, "driver", "driver"))
      .status,
    403,
  );
  assert.equal(
    (
      await call("/settings/organization", "DELETE", {
        ...body,
        organization_name: "Other",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/settings/organization", "DELETE", {
        ...body,
        acknowledged: false,
      })
    ).status,
    400,
  );
  assert.equal(
    (await call("/settings/organization", "DELETE", body, "colleague")).status,
    200,
  );
  const db = readDb();
  assert.deepEqual(
    db.organizations.map((o) => o.id),
    ["other"],
  );
  assert.equal(db.clients.length, 0);
  assert.equal(db.rides.length, 0);
  assert.equal(db.verifications.length, 0);
  assert.equal(db.drivers.length, 2);
  assert.equal(db.staff.length, 1);
  assert.equal((await call("/notifications")).status, 401);
});

test("push delivery retries transient failures, prunes expired subscriptions, and hides client data", async () => {
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_SUBJECT = "mailto:test@example.test";
  const sub = {
    endpoint: "https://fcm.googleapis.com/test",
    keys: { p256dh: keys.publicKey, auth: "a".repeat(22) },
  };
  assert.equal(
    (
      await call(
        "/notifications/subscriptions",
        "POST",
        { ...sub, endpoint: "http://127.0.0.1/private" },
        "driver",
        "driver",
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await call(
        "/notifications/subscriptions",
        "POST",
        sub,
        "driver",
        "driver",
      )
    ).status,
    201,
  );
  await new Promise((resolve) => setTimeout(resolve, 5));
  await update((db) => {
    db.rides[0].updated_at = new Date().toISOString();
  });
  const original = webpush.sendNotification;
  let payload;
  try {
    webpush.sendNotification = async (_, message) => {
      payload = JSON.parse(message);
      throw { statusCode: 503 };
    };
    await flushPush();
    assert.equal(readDb().pushDeliveries[0].attempts, 1);
    assert.equal(readDb().pushDeliveries[0].failed, undefined);
    assert.equal(payload.body.includes("Test Client"), false);
    await update((db) => {
      db.pushDeliveries[0].next_attempt_at = "2000-01-01";
    }, true);
    webpush.sendNotification = async () => {
      throw { statusCode: 410 };
    };
    await flushPush();
    assert.equal(readDb().pushSubscriptions.length, 0);
    assert.equal(readDb().pushDeliveries[0].failed, true);
  } finally {
    webpush.sendNotification = original;
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  }
});

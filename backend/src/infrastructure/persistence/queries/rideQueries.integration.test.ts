import type { ControlledTransaction } from "kysely";

import { sql } from "kysely";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { DatabaseClient, DatabaseSchema } from "../databaseClient.js";

import {
  startPostgresTestDatabase,
  type PostgresTestDatabase,
} from "../../../../test/postgresTestDatabase.js";
import { RideQueries } from "./rideQueries.js";

const organizationId = randomUUID();
const staffId = randomUUID();
const clientId = randomUUID();
const destinationId = randomUUID();
const rideId = randomUUID();
const pickupAt = new Date("2030-01-16T18:00:00.000Z");

let testDatabase: PostgresTestDatabase | undefined;
let database: DatabaseClient;

beforeAll(async () => {
  testDatabase = await startPostgresTestDatabase();
  database = testDatabase.database;
});

afterAll(async () => {
  await testDatabase?.stop();
});

// Roll back every fixture, including when an assertion or insert fails.
async function withRide(
  run: (
    queries: RideQueries,
    transaction: ControlledTransaction<DatabaseSchema>
  ) => Promise<void>
): Promise<void> {
  const transaction = await database.startTransaction().execute();
  try {
    await sql`
      INSERT INTO organizations (id, name, email, phone)
      VALUES (${organizationId}, 'Test organization', 'org@example.test', '555-0100')
    `.execute(transaction);
    await sql`
      INSERT INTO staff (id, organization_id, name, email, phone, password_hash)
      VALUES (${staffId}, ${organizationId}, 'Test staff', 'staff@example.test',
              '555-0101', 'unused-test-hash')
    `.execute(transaction);
    await sql`
      INSERT INTO clients (id, organization_id, first_name, last_name, dob)
      VALUES (${clientId}, ${organizationId}, 'Jamie', 'Rider', '1984-09-03')
    `.execute(transaction);
    await sql`
      INSERT INTO addresses
        (id, organization_id, name, address, latitude, longitude)
      VALUES
        (${randomUUID()}, ${organizationId}, 'Home', '123 Main St', 49.28, -123.12),
        (${destinationId}, ${organizationId}, 'Clinic', '456 Clinic St', 49.27, -123.11)
    `.execute(transaction);
    await sql`
      INSERT INTO ride_requests
        (id, client_id, requested_by_staff_id, organization_id,
         pickup_address, pickup_lat, pickup_lng,
         destination_id, destination_address, destination_lat, destination_lng,
         requested_pickup_at, passenger_count, status, trip_leg)
      VALUES
        (${rideId}, ${clientId}, ${staffId}, ${organizationId},
         '123 Main St', 49.28, -123.12,
         ${destinationId}, '456 Clinic St', 49.27, -123.11,
         ${pickupAt}, 2, 'requested', 'return')
    `.execute(transaction);

    await run(new RideQueries(transaction), transaction);
  } finally {
    await transaction.rollback().execute();
  }
}

describe("RideQueries.getNotificationContext", () => {
  test("joins the ride, client and address book into notification context", async () => {
    await withRide(async (queries) => {
      expect(await queries.getNotificationContext(rideId)).toEqual({
        requestedByStaffId: staffId,
        passengerCount: 2,
        pickupAt,
        tripLeg: "return",
        clientFirstName: "Jamie",
        destinationName: "Clinic",
        pickupName: "Home",
      });
    });
  });

  test("falls back to the ride's pickup address when it is outside the address book", async () => {
    await withRide(async (queries, transaction) => {
      await transaction
        .updateTable("ride_requests")
        .set({ pickup_address: "789 Other St" })
        .where("id", "=", rideId)
        .execute();

      expect(await queries.getNotificationContext(rideId)).toMatchObject({
        pickupName: "789 Other St",
        destinationName: "Clinic",
        clientFirstName: "Jamie",
      });
    });
  });

  test("returns null when the ride does not exist", async () => {
    await withRide(async (queries) => {
      expect(await queries.getNotificationContext(randomUUID())).toBeNull();
    });
  });
});

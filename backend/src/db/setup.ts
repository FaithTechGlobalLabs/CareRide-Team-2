import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import bcrypt from "bcrypt";

import { pool } from "./db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(here, "../../db/001_schema.sql");

const orgId = "11111111-1111-4111-8111-111111111111";
const alvinId = "22222222-2222-4222-8222-222222222201";
const arethaId = "22222222-2222-4222-8222-222222222202";
const billyId = "22222222-2222-4222-8222-222222222203";
const oliveId = "33333333-3333-4333-8333-333333333301";
const derekId = "33333333-3333-4333-8333-333333333302";
const kentonId = "33333333-3333-4333-8333-333333333303";
const esheanId = "33333333-3333-4333-8333-333333333304";
const jamieId = "44444444-4444-4444-8444-444444444401";
const chongId = "44444444-4444-4444-8444-444444444402";
const winnieId = "44444444-4444-4444-8444-444444444403";
const joeId = "44444444-4444-4444-8444-444444444404";
const belkinHouseId = "55555555-5555-4555-8555-555555555501";
const stPaulsId = "55555555-5555-4555-8555-555555555502";
const sampleRideId = "66666666-6666-4666-8666-666666666601";

async function seed(): Promise<void> {
  const existing = await pool.query("SELECT id FROM organizations LIMIT 1");
  if (existing.rowCount) {
    console.log("Seed skipped; organizations already exist.");
    return;
  }

  const passwordHash = await bcrypt.hash("CareRideDemo1", 10);
  const document = Buffer.from("Seed identity record for the demo approval.");
  const drivers = [
    [oliveId, "Olive", "Demo", "1990-04-12", "olive.demo@careride.local", "604-555-0102", "Toyota", "Corolla", "CR1234", 3, false, 25000],
    [derekId, "Derek", "Demo", "1987-08-21", "derek.demo@careride.local", "604-555-0103", "Honda", "Civic", "CR2201", 3, false, 30000],
    [kentonId, "Kenton", "Demo", "1992-02-16", "kenton.demo@careride.local", "604-555-0104", "Kia", "Carnival", "CR2202", 6, true, 35000],
    [esheanId, "Eshean", "Demo", "1985-11-30", "eshean.demo@careride.local", "604-555-0105", "Subaru", "Outback", "CR2203", 4, false, 40000],
  ] as const;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO organizations (id, name, email, phone)
       VALUES ($1, 'Belkin Communities of Hope', 'belkin@careride.local', '604-555-0100')`,
      [orgId],
    );
    await client.query(
      `INSERT INTO staff (id, organization_id, name, email, phone, password_hash)
       VALUES
         ($1, $4, 'Alvin Demo', 'alvin.demo@careride.local', '604-555-0101', $5),
         ($2, $4, 'Aretha Franklin', 'aretha.demo@careride.local', '604-555-0106', $5),
         ($3, $4, 'Billy Bob Joe', 'billy.demo@careride.local', '604-555-0107', $5)`,
      [alvinId, arethaId, billyId, orgId, passwordHash],
    );
    await client.query(
      `INSERT INTO clients
         (id, organization_id, first_name, last_name, dob, address, has_smartphone, phone, notes)
       VALUES
         ($1, $5, 'Jamie', 'Chen', '1984-09-03', '228 W. 5th Ave, Vancouver', false, '604-555-0199', 'Prefers the side door'),
         ($2, $5, 'Chong', 'Demo', '1991-06-18', 'Belkin House', true, '604-555-0196', 'Demo client record'),
         ($3, $5, 'Winnie', 'Demo', '1989-10-09', 'Belkin House', true, '604-555-0197', 'Demo client record'),
         ($4, $5, 'Joe', 'Demo', '1975-01-24', 'Belkin House', false, '604-555-0198', 'Demo client record')`,
      [jamieId, chongId, winnieId, joeId, orgId],
    );
    await client.query(
      `INSERT INTO addresses
         (id, organization_id, name, address, latitude, longitude, location_type)
       VALUES
         ($1, $3, 'Belkin House', '228 W. 5th Ave, Vancouver', 49.2665, -123.1128, 'shelter'),
         ($2, $3, 'St. Paul''s Hospital', '1081 Burrard St, Vancouver', 49.2806, -123.128, 'hospital')`,
      [belkinHouseId, stPaulsId, orgId],
    );

    for (const driver of drivers) {
      const [id, first, last, dob, email, phone, make, model, plate, seats, wheelchair, radius] = driver;
      await client.query(
        `INSERT INTO drivers (id, first_name, last_name, dob, email, phone, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, first, last, dob, email, phone, passwordHash],
      );
      await client.query(
        `INSERT INTO vehicles (driver_id, make, model, plate_number, seats, wheelchair_accessible)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [id, make, model, plate, seats, wheelchair],
      );
      await client.query(
        `INSERT INTO driver_availabilities
           (driver_id, centre, radius_m, is_active, kind, start_time, end_time, timezone, weekdays, note)
         VALUES (
           $1,
           ST_SetSRID(ST_MakePoint(-123.1128, 49.2665), 4326)::geography,
           $2,
           true,
           'weekly',
           '06:00',
           '22:00',
           'America/Vancouver',
           ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[],
           'Demo availability covering the user-test day.'
         )`,
        [id, radius],
      );
      await client.query(
        `INSERT INTO driver_verifications
           (driver_id, approved_by_org_id, approved_by_staff_id, document_type, document, document_filename, status, reviewed_at)
         VALUES ($1, $2, $3, 'identity', $4, 'seed-identity.txt', 'approved', now())`,
        [id, orgId, alvinId, document],
      );
    }

    await client.query(
      `INSERT INTO ride_requests (
         id, client_id, requested_by_staff_id, organization_id,
         pickup_address, pickup_lat, pickup_lng,
         destination_id, destination_address, destination_lat, destination_lng,
         requested_pickup_at, passenger_count, accessibility_needs, notes,
         status, driver_id, approved_at, ride_option,
         created_at, updated_at, completed_at,
         is_client_picked_up, is_client_dropped_off, trip_leg
       ) VALUES (
         $1, $2, $3, $4,
         '228 W. 5th Ave, Vancouver', 49.2665, -123.1128,
         $5, '1081 Burrard St, Vancouver', 49.2806, -123.128,
         now() - interval '26 hours', 1, '{}', 'Sample completed ride for the dashboard.',
         'completed', $6, now() - interval '26 hours', 'free',
         now() - interval '26 hours', now() - interval '26 hours', now() - interval '26 hours',
         true, true, 'outbound'
       )`,
      [sampleRideId, jamieId, alvinId, orgId, stPaulsId, oliveId],
    );
    await client.query(
      `INSERT INTO dispatches (ride_request_id, driver_id, response, responded_at, offered_at)
       VALUES ($1, $2, 'accepted', now() - interval '26 hours', now() - interval '26 hours')`,
      [sampleRideId, oliveId],
    );
    await client.query("COMMIT");
    console.log("Seeded Belkin, staff, drivers, clients, and one completed ride.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const schema = fs.readFileSync(schemaPath, "utf8");
const exists = await pool.query("SELECT to_regclass('public.organizations') AS name");
if (!exists.rows[0]?.name) {
  await pool.query(schema);
  console.log("Applied backend/db/001_schema.sql");
} else {
  console.log("Schema already present.");
}
await seed();
await pool.end();

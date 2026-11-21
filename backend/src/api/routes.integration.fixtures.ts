import { sql } from "kysely";
import { randomUUID } from "node:crypto";

import type { DatabaseClient } from "../infrastructure/persistence/databaseClient.js";

export async function driverNotificationFixture(database: DatabaseClient) {
  const org = randomUUID(),
    staff = randomUUID(),
    client = randomUUID();
  const pickup = randomUUID(),
    destination = randomUUID();
  const drivers = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  await sql`INSERT INTO organizations (id,name,email,phone) VALUES (${org},'Test org',${org + "@example.test"},'555')`.execute(
    database
  );
  await sql`INSERT INTO staff (id,organization_id,name,email,phone,password_hash)
    VALUES (${staff},${org},'Staff',${staff + "@example.test"},'555','unused')`.execute(
    database
  );
  await sql`INSERT INTO clients (id,organization_id,first_name,last_name,dob)
    VALUES (${client},${org},'Test','Rider','1980-01-01')`.execute(database);
  await sql`INSERT INTO addresses (id,organization_id,name,address,latitude,longitude) VALUES
    (${pickup},${org},'Home','Home address',49.28,-123.12),
    (${destination},${org},'Clinic','Clinic address',49.281,-123.121)`.execute(
    database
  );
  for (const [index, driver] of drivers.entries()) {
    await sql`INSERT INTO drivers (id,first_name,last_name,dob,email,phone,password_hash)
      VALUES (${driver},'Driver','Test','1980-01-01',${driver + "@example.test"},'555','unused')`.execute(
      database
    );
    await sql`INSERT INTO vehicles (driver_id,make,model,plate_number,seats)
      VALUES (${driver},'Test','Car','TEST',4)`.execute(database);
    if (index !== 2)
      await sql`INSERT INTO driver_verifications
      (driver_id,approved_by_org_id,document_type,document,status)
      VALUES (${driver},${org},'license',decode('00','hex'),'approved')`.execute(
        database
      );
    await sql`INSERT INTO driver_availabilities
      (driver_id,centre,radius_m,kind,start_time,end_time,timezone,weekdays)
      SELECT ${driver},ST_SetSRID(ST_MakePoint(-123.12,49.28),4326)::geography,10000,
        'weekly','00:00','23:59','UTC',ARRAY[0,1,2,3,4,5,6]::smallint[]
      FROM generate_series(1,2)`.execute(database);
    await sql`INSERT INTO notification_preferences (user_id,kind,push_enabled,available_rides_enabled)
      VALUES (${driver},'driver',${index !== 1},${index !== 3})`.execute(
      database
    );
    await sql`INSERT INTO push_subscriptions (endpoint,user_id,kind,p256dh,auth)
      VALUES (${"https://push.example.test/" + driver},${driver},'driver','key','auth')`.execute(
      database
    );
  }
  const body = {
    client_id: client,
    pickup_destination_id: pickup,
    destination_id: destination,
    requested_pickup_at: "2035-01-16T10:00:00Z",
    return_pickup_at: "2035-01-16T14:00:00Z",
    passenger_count: 2,
    accessibility_needs: [] as string[],
    trip_type: "round_trip",
  };
  return {
    org,
    staff,
    client,
    pickup,
    destination,
    drivers,
    body,
    async cleanup() {
      await sql`DELETE FROM ride_requests WHERE organization_id = ${org}`.execute(
        database
      );
      await sql`DELETE FROM notification_preferences WHERE user_id = ANY(${drivers}::uuid[])`.execute(
        database
      );
      await sql`DELETE FROM drivers WHERE id = ANY(${drivers}::uuid[])`.execute(
        database
      );
      await sql`DELETE FROM organizations WHERE id = ${org}`.execute(database);
    },
  };
}

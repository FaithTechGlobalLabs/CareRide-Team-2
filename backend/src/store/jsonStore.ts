import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import bcrypt from "bcrypt";

import type {
  Driver,
  DriverAvailability,
  DriverVerification,
  Vehicle,
} from "../types/driver.types.js";
import type { Notification } from "../types/notification.types.js";
import type { Destination, Organization } from "../types/organization.types.js";
import type { RideRequest } from "../types/ride.types.js";
import type { Client, Staff } from "../types/user.types.js";

export interface Db {
  organizations: Organization[];
  staff: Staff[];
  clients: Client[];
  destinations: Destination[];
  rides: RideRequest[];
  drivers: Driver[];
  vehicles: Vehicle[];
  availabilities: DriverAvailability[];
  verifications: DriverVerification[];
  notifications: Notification[];
}

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "../../data");
const storePath = path.join(dataDir, "store.json");

let queue: Promise<void> = Promise.resolve();

function emptyDb(): Db {
  return {
    organizations: [],
    staff: [],
    clients: [],
    destinations: [],
    rides: [],
    drivers: [],
    vehicles: [],
    availabilities: [],
    verifications: [],
    notifications: [],
  };
}

function seed(): Db {
  const now = new Date().toISOString();
  const passwordHash = bcrypt.hashSync("CareRideDemo1", 10);
  const completedAt = new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString();

  const belkin: Organization = {
    id: "org_belkin",
    name: "Belkin Communities of Hope",
    email: "belkin@careride.local",
    phone: "604-555-0100",
    created_at: now,
  };

  const staff: Staff = {
    id: "staff_alvin",
    organization_id: belkin.id,
    name: "Alvin Demo",
    email: "alvin.demo@careride.local",
    phone: "604-555-0101",
    password_hash: passwordHash,
    is_active: true,
  };

  const additionalStaff: Staff[] = [
    {
      id: "staff_aretha",
      organization_id: belkin.id,
      name: "Aretha Franklin",
      email: "aretha.demo@careride.local",
      phone: "604-555-0106",
      password_hash: passwordHash,
      is_active: true,
    },
    {
      id: "staff_billy",
      organization_id: belkin.id,
      name: "Billy Bob Joe",
      email: "billy.demo@careride.local",
      phone: "604-555-0107",
      password_hash: passwordHash,
      is_active: true,
    },
  ];

  const driver: Driver = {
    id: "driver_olive",
    first_name: "Olive",
    last_name: "Demo",
    dob: "1990-04-12",
    email: "olive.demo@careride.local",
    phone: "604-555-0102",
    password_hash: passwordHash,
  };

  const additionalDrivers: Driver[] = [
    {
      id: "driver_derek",
      first_name: "Derek",
      last_name: "Demo",
      dob: "1987-08-21",
      email: "derek.demo@careride.local",
      phone: "604-555-0103",
      password_hash: passwordHash,
    },
    {
      id: "driver_kenton",
      first_name: "Kenton",
      last_name: "Demo",
      dob: "1992-02-16",
      email: "kenton.demo@careride.local",
      phone: "604-555-0104",
      password_hash: passwordHash,
    },
    {
      id: "driver_eshean",
      first_name: "Eshean",
      last_name: "Demo",
      dob: "1985-11-30",
      email: "eshean.demo@careride.local",
      phone: "604-555-0105",
      password_hash: passwordHash,
    },
  ];

  const vehicle: Vehicle = {
    id: "vehicle_olive",
    driver_id: driver.id,
    make: "Toyota",
    model: "Corolla",
    plate_number: "CR1234",
    seats: 3,
    wheelchair_accessible: false,
  };

  const availability: DriverAvailability = {
    id: "avail_olive",
    driver_id: driver.id,
    centre_lat: 49.2665,
    centre_lng: -123.1128,
    radius_m: 25000,
    is_active: true,
    kind: "weekly",
    start_time: "06:00",
    end_time: "22:00",
    timezone: "America/Vancouver",
    weekdays: [0, 1, 2, 3, 4, 5, 6],
    note: "Demo availability covering the user-test afternoon.",
  };

  const verification: DriverVerification = {
    id: "ver_olive",
    driver_id: driver.id,
    approved_by_org_id: belkin.id,
    approved_by_staff_id: staff.id,
    document_type: "identity",
    document_filename: "seed-identity.txt",
    status: "approved",
    reviewed_at: now,
  };

  const client: Client = {
    id: "client_jamie",
    organization_id: belkin.id,
    first_name: "Jamie",
    last_name: "Chen",
    dob: "1984-09-03",
    address: "228 W. 5th Ave, Vancouver",
    has_smartphone: false,
    phone: "604-555-0199",
    notes: "Prefers the side door",
    created_at: now,
  };

  const additionalClients: Client[] = [
    {
      id: "client_chong",
      organization_id: belkin.id,
      first_name: "Chong",
      last_name: "Demo",
      dob: "1991-06-18",
      address: "Belkin House",
      has_smartphone: true,
      phone: "604-555-0196",
      notes: "Demo client record",
      created_at: now,
    },
    {
      id: "client_winnie",
      organization_id: belkin.id,
      first_name: "Winnie",
      last_name: "Demo",
      dob: "1989-10-09",
      address: "Belkin House",
      has_smartphone: true,
      phone: "604-555-0197",
      notes: "Demo client record",
      created_at: now,
    },
    {
      id: "client_joe",
      organization_id: belkin.id,
      first_name: "Joe",
      last_name: "Demo",
      dob: "1975-01-24",
      address: "Belkin House",
      has_smartphone: false,
      phone: "604-555-0198",
      notes: "Demo client record",
      created_at: now,
    },
  ];

  const additionalVehicles: Vehicle[] = [
    {
      id: "vehicle_derek",
      driver_id: "driver_derek",
      make: "Honda",
      model: "Civic",
      plate_number: "CR2201",
      seats: 3,
      wheelchair_accessible: false,
    },
    {
      id: "vehicle_kenton",
      driver_id: "driver_kenton",
      make: "Kia",
      model: "Carnival",
      plate_number: "CR2202",
      seats: 6,
      wheelchair_accessible: true,
    },
    {
      id: "vehicle_eshean",
      driver_id: "driver_eshean",
      make: "Subaru",
      model: "Outback",
      plate_number: "CR2203",
      seats: 4,
      wheelchair_accessible: false,
    },
  ];

  const additionalAvailabilities: DriverAvailability[] = additionalDrivers.map(
    (item, index) => ({
      id: `avail_${item.id.replace("driver_", "")}`,
      driver_id: item.id,
      centre_lat: 49.2665,
      centre_lng: -123.1128,
      radius_m: (25 + index * 5) * 1000,
      is_active: true,
      kind: "weekly",
      start_time: "06:00",
      end_time: "22:00",
      timezone: "America/Vancouver",
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      note: "Demo availability covering the user-test day.",
    }),
  );

  const additionalVerifications: DriverVerification[] = additionalDrivers.map(
    (item) => ({
      id: `ver_${item.id.replace("driver_", "")}`,
      driver_id: item.id,
      approved_by_org_id: belkin.id,
      approved_by_staff_id: staff.id,
      document_type: "identity",
      document_filename: "seed-identity.txt",
      status: "approved",
      reviewed_at: now,
    }),
  );

  const belkinHouse: Destination = {
    id: "dest_belkin",
    organization_id: belkin.id,
    name: "Belkin House",
    type: "shelter",
    address: "228 W. 5th Ave, Vancouver",
    lat: 49.2665,
    lng: -123.1128,
    is_active: true,
  };

  const stPauls: Destination = {
    id: "dest_stpauls",
    organization_id: belkin.id,
    name: "St. Paul's Hospital",
    type: "hospital",
    address: "1081 Burrard St, Vancouver",
    lat: 49.2806,
    lng: -123.128,
    is_active: true,
  };

  const sampleRide: RideRequest = {
    id: "ride_sample",
    client_id: client.id,
    requested_by_staff_id: staff.id,
    organization_id: belkin.id,
    pickup_address: belkinHouse.address,
    pickup_lat: belkinHouse.lat,
    pickup_lng: belkinHouse.lng,
    destination_id: stPauls.id,
    destination_address: stPauls.address,
    destination_lat: stPauls.lat,
    destination_lng: stPauls.lng,
    trip_leg: "outbound",
    requested_pickup_at: completedAt,
    passenger_count: 1,
    accessibility_needs: [],
    notes: "Sample completed ride for the dashboard.",
    status: "completed",
    driver_id: driver.id,
    ride_option: "free",
    is_client_picked_up: true,
    is_client_dropped_off: true,
    created_at: completedAt,
    updated_at: completedAt,
    completed_at: completedAt,
  };

  return {
    organizations: [belkin],
    staff: [staff, ...additionalStaff],
    clients: [client, ...additionalClients],
    destinations: [belkinHouse, stPauls],
    rides: [sampleRide],
    drivers: [driver, ...additionalDrivers],
    vehicles: [vehicle, ...additionalVehicles],
    availabilities: [availability, ...additionalAvailabilities],
    verifications: [verification, ...additionalVerifications],
    notifications: [],
  };
}

function read(): Db {
  if (!fs.existsSync(storePath)) {
    fs.mkdirSync(dataDir, { recursive: true });
    const db = seed();
    fs.writeFileSync(storePath, JSON.stringify(db, null, 2));
    return db;
  }
  const parsed = JSON.parse(fs.readFileSync(storePath, "utf8")) as Db;
  return parsed;
}

function write(db: Db): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${storePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, storePath);
}

export function update<T>(fn: (db: Db) => T): Promise<T> {
  let result: T | undefined;
  const run = queue.then(() => {
    const db = read();
    result = fn(db);
    write(db);
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run.then(() => result as T);
}

export function readDb(): Db {
  return read();
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export function uploadsDir(): string {
  const dir = path.join(dataDir, "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

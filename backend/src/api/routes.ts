import type { NextFunction, Request, Response } from "express";
import type { Express } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import type { PoolClient } from "pg";

import { registerPersonalApi } from "./personal.js";
import { pool } from "../db/db.js";

const secret = process.env.JWT_SECRET || "careride-dev-secret";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5_000_000 },
});

interface Auth {
  sub: string;
  kind: "staff" | "driver";
  role: string;
  organizationId?: string;
}

interface AuthedRequest extends Request {
  auth?: Auth;
}

const eligibleSql = `
  r.status = 'requested'
  AND r.driver_id IS NULL
  AND r.requested_pickup_at > now()
  AND EXISTS (
    SELECT 1 FROM driver_verifications v
    WHERE v.driver_id = $DRIVER
      AND v.approved_by_org_id = r.organization_id
      AND v.status = 'approved'
      AND (v.expires_on IS NULL OR v.expires_on >= CURRENT_DATE)
  )
  AND EXISTS (
    SELECT 1 FROM vehicles veh
    WHERE veh.driver_id = $DRIVER
      AND veh.seats >= r.passenger_count
      AND (
        veh.wheelchair_accessible
        OR NOT EXISTS (
          SELECT 1 FROM unnest(r.accessibility_needs) need
          WHERE lower(need) LIKE '%wheelchair%'
        )
      )
  )
  AND EXISTS (
    SELECT 1 FROM driver_availabilities a
    WHERE a.driver_id = $DRIVER
      AND a.is_active
      AND (r.requested_pickup_at AT TIME ZONE a.timezone)::time BETWEEN a.start_time AND a.end_time
      AND (a.starts_on IS NULL OR (r.requested_pickup_at AT TIME ZONE a.timezone)::date >= a.starts_on)
      AND (a.ends_on IS NULL OR (r.requested_pickup_at AT TIME ZONE a.timezone)::date <= a.ends_on)
      AND (
        (a.kind = 'one_time' AND a.on_date = (r.requested_pickup_at AT TIME ZONE a.timezone)::date)
        OR (
          a.kind = 'weekly'
          AND EXTRACT(DOW FROM r.requested_pickup_at AT TIME ZONE a.timezone)::int = ANY (a.weekdays::int[])
        )
        OR (
          a.kind = 'monthly'
          AND EXTRACT(DAY FROM r.requested_pickup_at AT TIME ZONE a.timezone)::int = ANY (a.month_days::int[])
        )
      )
      AND ST_DWithin(
        a.centre,
        ST_SetSRID(ST_MakePoint(r.pickup_lng, r.pickup_lat), 4326)::geography,
        a.radius_m
      )
  )
`;

function sign(auth: Auth): string {
  return jwt.sign(auth, secret, { expiresIn: "12h" });
}

function requireAuth(kind?: Auth["kind"]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      res.status(401).json({ message: "Login required." });
      return;
    }
    try {
      const auth = jwt.verify(token, secret) as Auth;
      if (kind && auth.kind !== kind) {
        res.status(403).json({ message: "This account cannot open that page." });
        return;
      }
      req.auth = auth;
      next();
    } catch {
      res.status(401).json({ message: "Login expired." });
    }
  };
}

function asyncRoute(fn: (req: AuthedRequest, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as AuthedRequest, res)).catch(next);
  };
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function iso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function clock(value: unknown): string {
  return String(value).slice(0, 5);
}

function needs(body: unknown): string[] {
  if (Array.isArray(body)) return body.map(String).map((item) => item.trim()).filter(Boolean);
  const text = String(body ?? "").trim();
  if (!text) return [];
  return text.split(",").map((item) => item.trim()).filter(Boolean);
}

function rideMessage(input: {
  firstName: string;
  when: string;
  pickup: string;
  destination: string;
  passengers: number;
  leg?: string;
}): string {
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Vancouver",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(input.when));
  const people = input.passengers === 1 ? "1 passenger" : `${input.passengers} passengers`;
  const way = input.leg === "return" ? "Return leg" : "One way";
  return `${input.firstName}: ${when}: ${input.pickup} to ${input.destination}. ${way}, ${people}.`;
}

async function notifyStaff(
  client: PoolClient,
  rideId: string,
  title: string,
): Promise<void> {
  const ride = await client.query(
    `SELECT r.id, r.organization_id, r.pickup_address, r.destination_id, r.requested_by_staff_id,
            r.passenger_count, r.requested_pickup_at, r.trip_leg, c.first_name,
            dest.name AS destination_name,
            COALESCE(pickup.name, r.pickup_address) AS pickup_name
     FROM ride_requests r
     JOIN clients c ON c.id = r.client_id
     JOIN addresses dest ON dest.id = r.destination_id
     LEFT JOIN addresses pickup
       ON pickup.organization_id = r.organization_id AND pickup.address = r.pickup_address
     WHERE r.id = $1`,
    [rideId],
  );
  const row = ride.rows[0] as
    | {
        requested_by_staff_id: string;
        passenger_count: number;
        requested_pickup_at: Date;
        trip_leg: string | null;
        first_name: string;
        destination_name: string;
        pickup_name: string;
      }
    | undefined;
  if (!row) return;
  const message = rideMessage({
    firstName: row.first_name,
    when: row.requested_pickup_at.toISOString(),
    pickup: row.pickup_name,
    destination: row.destination_name,
    passengers: row.passenger_count,
    ...(row.trip_leg ? { leg: row.trip_leg } : {}),
  });
  await client.query(
    `INSERT INTO notifications
       (staff_id, ride_request_id, title, message, action_url, channel, metadata)
     VALUES ($1, $2, $3, $4, $5, 'in_app', $6::jsonb)`,
    [
      row.requested_by_staff_id,
      rideId,
      title,
      message,
      `/rides/${rideId}`,
      JSON.stringify({
        passenger_count: row.passenger_count,
        trip_leg: row.trip_leg,
      }),
    ],
  );
}

async function presentRide(client: PoolClient | typeof pool, id: string) {
  const result = await client.query(
    `SELECT r.*,
            c.first_name, c.last_name,
            d.first_name AS driver_first_name,
            d.last_name AS driver_last_name,
            d.phone AS driver_phone,
            v.make, v.model, v.plate_number, v.seats
     FROM ride_requests r
     JOIN clients c ON c.id = r.client_id
     LEFT JOIN drivers d ON d.id = r.driver_id
     LEFT JOIN LATERAL (
       SELECT make, model, plate_number, seats
       FROM vehicles
       WHERE driver_id = d.id
       LIMIT 1
     ) v ON true
     WHERE r.id = $1`,
    [id],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return shapeRide(row);
}

function shapeRide(row: Record<string, unknown>) {
  const needsList = Array.isArray(row.accessibility_needs)
    ? (row.accessibility_needs as string[])
    : [];
  const driverName = row.driver_first_name
    ? `${row.driver_first_name} ${row.driver_last_name}`
    : null;
  return {
    id: row.id,
    client_id: row.client_id,
    requested_by_staff_id: row.requested_by_staff_id,
    organization_id: row.organization_id,
    pickup_address: row.pickup_address,
    pickup_lat: row.pickup_lat,
    pickup_lng: row.pickup_lng,
    destination_id: row.destination_id,
    destination_address: row.destination_address,
    destination_lat: row.destination_lat,
    destination_lng: row.destination_lng,
    requested_pickup_at: iso(row.requested_pickup_at),
    passenger_count: row.passenger_count,
    accessibility_needs: needsList.join(", "),
    accessibility_need_list: needsList,
    notes: row.notes,
    // The database calls an accepted ride "approved"; screens use "accepted".
    status: row.status === "approved" ? "accepted" : row.status,
    driver_id: row.driver_id,
    approved_by_user_id: row.approved_by_user_id,
    approved_at: iso(row.approved_at),
    accepted_at: iso(row.approved_at),
    ride_option: row.ride_option,
    created_at: iso(row.created_at),
    updated_at: iso(row.updated_at),
    completed_at: iso(row.completed_at),
    cancelled_reason: row.cancelled_reason,
    is_client_picked_up: row.is_client_picked_up,
    is_client_dropped_off: row.is_client_dropped_off,
    trip_group_id: row.trip_group_id,
    linked_ride_id: row.linked_ride_id,
    trip_leg: row.trip_leg,
    client_name: `${row.first_name} ${row.last_name}`,
    driver_name: driverName,
    driver_phone: row.driver_phone ?? null,
    vehicle: row.plate_number
      ? {
          make: row.make,
          model: row.model,
          plate: row.plate_number,
          seats: row.seats,
        }
      : null,
    sample: row.id === "66666666-6666-4666-8666-666666666601",
  };
}

async function markTimedOut(): Promise<void> {
  await pool.query(
    `UPDATE ride_requests
     SET status = 'timed_out', updated_at = now()
     WHERE status = 'requested'
       AND driver_id IS NULL
       AND requested_pickup_at <= now()`,
  );
}

const rideListSql = `
  SELECT r.*,
         c.first_name, c.last_name,
         d.first_name AS driver_first_name,
         d.last_name AS driver_last_name,
         d.phone AS driver_phone,
         v.make, v.model, v.plate_number, v.seats
  FROM ride_requests r
  JOIN clients c ON c.id = r.client_id
  LEFT JOIN drivers d ON d.id = r.driver_id
  LEFT JOIN LATERAL (
    SELECT make, model, plate_number, seats FROM vehicles WHERE driver_id = d.id LIMIT 1
  ) v ON true
`;

export function registerApi(app: Express): void {
  registerPersonalApi(app, requireAuth());
  app.post(
    "/auth/login",
    asyncRoute(async (req, res) => {
      const email = String(req.body.email ?? "").trim().toLowerCase();
      const password = String(req.body.password ?? "");
      const staff = await pool.query(
        `SELECT s.*, o.name AS organization_name
         FROM staff s
         JOIN organizations o ON o.id = s.organization_id
         WHERE lower(s.email) = $1 AND s.is_active`,
        [email],
      );
      const staffRow = staff.rows[0] as
        | { id: string; organization_id: string; name: string; email: string; phone: string; password_hash: string; organization_name: string }
        | undefined;
      if (staffRow && (await bcrypt.compare(password, staffRow.password_hash))) {
        const auth: Auth = {
          sub: staffRow.id,
          kind: "staff",
          role: "staff",
          organizationId: staffRow.organization_id,
        };
        res.json({
          token: sign(auth),
          user: {
            id: staffRow.id,
            organization_id: staffRow.organization_id,
            name: staffRow.name,
            email: staffRow.email,
            phone: staffRow.phone,
            kind: "staff",
            role: "staff",
            organization_name: staffRow.organization_name,
          },
        });
        return;
      }
      const driver = await pool.query(
        `SELECT * FROM drivers WHERE lower(email) = $1`,
        [email],
      );
      const driverRow = driver.rows[0] as
        | { id: string; first_name: string; last_name: string; email: string; phone: string; password_hash: string; dob: string }
        | undefined;
      if (driverRow && (await bcrypt.compare(password, driverRow.password_hash))) {
        const auth: Auth = { sub: driverRow.id, kind: "driver", role: "driver" };
        res.json({
          token: sign(auth),
          user: {
            id: driverRow.id,
            name: `${driverRow.first_name} ${driverRow.last_name}`,
            first_name: driverRow.first_name,
            last_name: driverRow.last_name,
            email: driverRow.email,
            phone: driverRow.phone,
            dob: iso(driverRow.dob),
            kind: "driver",
            role: "driver",
          },
        });
        return;
      }
      res.status(401).json({ message: "Email or password is incorrect." });
    }),
  );

  app.get(
    "/auth/me",
    requireAuth(),
    asyncRoute(async (req, res) => {
      const auth = req.auth;
      if (!auth) {
        res.status(401).json({ message: "Login required." });
        return;
      }
      if (auth.kind === "staff") {
        const staff = await pool.query(
          `SELECT s.id, s.organization_id, s.name, s.email, s.phone, o.name AS organization_name
           FROM staff s JOIN organizations o ON o.id = s.organization_id
           WHERE s.id = $1`,
          [auth.sub],
        );
        const row = staff.rows[0];
        if (!row) {
          res.status(401).json({ message: "Login required." });
          return;
        }
        res.json({ user: { ...row, kind: "staff", role: "staff" } });
        return;
      }
      const driver = await pool.query(
        `SELECT id, first_name, last_name, email, phone, dob FROM drivers WHERE id = $1`,
        [auth.sub],
      );
      const row = driver.rows[0] as { first_name: string; last_name: string } | undefined;
      if (!row) {
        res.status(401).json({ message: "Login required." });
        return;
      }
      res.json({
        user: { ...row, name: `${row.first_name} ${row.last_name}`, kind: "driver", role: "driver" },
      });
    }),
  );

  app.get("/organizations", async (_req, res) => {
    const result = await pool.query(
      `SELECT id, name FROM organizations ORDER BY name`,
    );
    res.json({ organizations: result.rows });
  });

  app.post(
    "/organizations/register",
    asyncRoute(async (req, res) => {
      const name = String(req.body.name ?? "").trim();
      const email = String(req.body.email ?? "").trim().toLowerCase();
      const phone = String(req.body.phone ?? "").trim();
      const adminName = String(req.body.admin_name ?? "").trim();
      const adminEmail = String(req.body.admin_email ?? "").trim().toLowerCase();
      const adminPassword = String(req.body.admin_password ?? "");
      const adminPhone = String(req.body.admin_phone ?? phone).trim();
      if (!name || !email || !phone || !adminName || !adminEmail || adminPassword.length < 8) {
        res.status(400).json({ message: "Fill in the organization and a password of at least 8 characters." });
        return;
      }
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      try {
        const created = await pool.query(
          `WITH org AS (
             INSERT INTO organizations (name, email, phone)
             VALUES ($1, $2, $3)
             RETURNING id, name, email, phone
           )
           INSERT INTO staff (organization_id, name, email, phone, password_hash)
           SELECT id, $4, $5, $6, $7 FROM org
           RETURNING id, organization_id, name, email, phone`,
          [name, email, phone, adminName, adminEmail, adminPhone, passwordHash],
        );
        const staff = created.rows[0] as {
          id: string;
          organization_id: string;
          name: string;
          email: string;
          phone: string;
        };
        const org = await pool.query(`SELECT name FROM organizations WHERE id = $1`, [staff.organization_id]);
        const auth: Auth = {
          sub: staff.id,
          kind: "staff",
          role: "staff",
          organizationId: staff.organization_id,
        };
        res.status(201).json({
          token: sign(auth),
          user: {
            ...staff,
            kind: "staff",
            role: "staff",
            organization_name: org.rows[0]?.name ?? name,
          },
        });
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "23505") {
          res.status(409).json({ message: "That email is already registered." });
          return;
        }
        throw error;
      }
    }),
  );

  app.get(
    "/clients",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const q = String(req.query.q ?? "").trim().toLowerCase();
      const result = await pool.query(
        `SELECT id, organization_id, first_name, last_name, dob::text, address, has_smartphone,
                phone, email, emergency_contact_name, emergency_contact_phone, notes, created_at
         FROM clients
         WHERE organization_id = $1
           AND ($2 = '' OR lower(first_name || ' ' || last_name) LIKE '%' || $2 || '%')
         ORDER BY last_name, first_name`,
        [req.auth?.organizationId, q],
      );
      res.json({
        clients: result.rows.map((row) => ({ ...row, created_at: iso(row.created_at) })),
      });
    }),
  );

  app.post(
    "/clients",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const first = String(req.body.first_name ?? "").trim();
      const last = String(req.body.last_name ?? "").trim();
      const dob = String(req.body.dob ?? "").trim();
      const notes = String(req.body.notes ?? "").trim();
      if (!first || !last || !dob) {
        res.status(400).json({ message: "First name, last name, and date of birth are required." });
        return;
      }
      if (notes.length > 50) {
        res.status(400).json({ message: "Accommodations must be 50 characters or fewer." });
        return;
      }
      const result = await pool.query(
        `INSERT INTO clients
           (organization_id, first_name, last_name, dob, address, has_smartphone, phone, email,
            emergency_contact_name, emergency_contact_phone, notes)
         VALUES ($1,$2,$3,$4, NULLIF($5,''), $6, NULLIF($7,''), NULLIF($8,''), NULLIF($9,''), NULLIF($10,''), NULLIF($11,''))
         RETURNING id, organization_id, first_name, last_name, dob::text, address, has_smartphone,
                   phone, email, emergency_contact_name, emergency_contact_phone, notes, created_at`,
        [
          req.auth?.organizationId,
          first,
          last,
          dob,
          String(req.body.address ?? "").trim(),
          Boolean(req.body.has_smartphone),
          String(req.body.phone ?? "").trim(),
          String(req.body.email ?? "").trim(),
          String(req.body.emergency_contact_name ?? "").trim(),
          String(req.body.emergency_contact_phone ?? "").trim(),
          notes,
        ],
      );
      res.status(201).json({ client: { ...result.rows[0], created_at: iso(result.rows[0]?.created_at) } });
    }),
  );

  app.patch(
    "/clients/:id",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const notes = req.body.notes === undefined ? null : String(req.body.notes).trim();
      if (notes && notes.length > 50) {
        res.status(400).json({ message: "Accommodations must be 50 characters or fewer." });
        return;
      }
      const result = await pool.query(
        `UPDATE clients SET
           first_name = COALESCE(NULLIF($3, ''), first_name),
           last_name = COALESCE(NULLIF($4, ''), last_name),
           dob = COALESCE(NULLIF($5, '')::date, dob),
           address = CASE WHEN $6::text IS NULL THEN address ELSE NULLIF($6, '') END,
           phone = CASE WHEN $7::text IS NULL THEN phone ELSE NULLIF($7, '') END,
           email = CASE WHEN $8::text IS NULL THEN email ELSE NULLIF($8, '') END,
           emergency_contact_name = CASE WHEN $9::text IS NULL THEN emergency_contact_name ELSE NULLIF($9, '') END,
           emergency_contact_phone = CASE WHEN $10::text IS NULL THEN emergency_contact_phone ELSE NULLIF($10, '') END,
           notes = CASE WHEN $11::boolean THEN NULLIF($12, '') ELSE notes END,
           has_smartphone = COALESCE($13, has_smartphone)
         WHERE id = $1 AND organization_id = $2
         RETURNING id, organization_id, first_name, last_name, dob::text, address, has_smartphone,
                   phone, email, emergency_contact_name, emergency_contact_phone, notes, created_at`,
        [
          param(req, "id"),
          req.auth?.organizationId,
          String(req.body.first_name ?? ""),
          String(req.body.last_name ?? ""),
          String(req.body.dob ?? ""),
          req.body.address === undefined ? null : String(req.body.address),
          req.body.phone === undefined ? null : String(req.body.phone),
          req.body.email === undefined ? null : String(req.body.email),
          req.body.emergency_contact_name === undefined ? null : String(req.body.emergency_contact_name),
          req.body.emergency_contact_phone === undefined ? null : String(req.body.emergency_contact_phone),
          req.body.notes !== undefined,
          notes ?? "",
          req.body.has_smartphone === undefined ? null : Boolean(req.body.has_smartphone),
        ],
      );
      if (!result.rows[0]) {
        res.status(404).json({ message: "Client not found." });
        return;
      }
      res.json({ client: { ...result.rows[0], created_at: iso(result.rows[0].created_at) } });
    }),
  );

  app.get(
    "/destinations",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const q = String(req.query.q ?? "").trim().toLowerCase();
      const type = String(req.query.type ?? "");
      const result = await pool.query(
        `SELECT id, organization_id, name, location_type AS type, address,
                latitude AS lat, longitude AS lng, is_active
         FROM addresses
         WHERE organization_id = $1
           AND ($2 = '' OR location_type = $2)
           AND ($3 = '' OR lower(name || ' ' || address) LIKE '%' || $3 || '%')
         ORDER BY name`,
        [req.auth?.organizationId, type === "all" ? "" : type, q],
      );
      res.json({ destinations: result.rows });
    }),
  );

  app.post(
    "/destinations",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const name = String(req.body.name ?? "").trim();
      const type = String(req.body.type ?? "service");
      const address = String(req.body.address ?? "").trim();
      const lat = Number(req.body.lat);
      const lng = Number(req.body.lng);
      if (!name || !address || !["hospital", "shelter", "service"].includes(type)) {
        res.status(400).json({ message: "Name, type, and address are required." });
        return;
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).json({ message: "Drop a map pin for this location." });
        return;
      }
      const result = await pool.query(
        `INSERT INTO addresses (organization_id, name, address, latitude, longitude, location_type, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING id, organization_id, name, location_type AS type, address, latitude AS lat, longitude AS lng, is_active`,
        [req.auth?.organizationId, name, address, lat, lng, type, req.body.is_active !== false],
      );
      res.status(201).json({ destination: result.rows[0] });
    }),
  );

  app.patch(
    "/destinations/:id",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        `UPDATE addresses SET
           name = COALESCE(NULLIF($3, ''), name),
           address = COALESCE(NULLIF($4, ''), address),
           location_type = CASE
             WHEN $5 IN ('hospital', 'shelter', 'service') THEN $5
             ELSE location_type
           END,
           latitude = COALESCE($6, latitude),
           longitude = COALESCE($7, longitude),
           is_active = COALESCE($8, is_active)
         WHERE id = $1 AND organization_id = $2
         RETURNING id, organization_id, name, location_type AS type, address, latitude AS lat, longitude AS lng, is_active`,
        [
          param(req, "id"),
          req.auth?.organizationId,
          String(req.body.name ?? ""),
          String(req.body.address ?? ""),
          String(req.body.type ?? ""),
          req.body.lat === undefined ? null : Number(req.body.lat),
          req.body.lng === undefined ? null : Number(req.body.lng),
          req.body.is_active === undefined ? null : Boolean(req.body.is_active),
        ],
      );
      if (!result.rows[0]) {
        res.status(404).json({ message: "Location not found." });
        return;
      }
      res.json({ destination: result.rows[0] });
    }),
  );

  app.get(
    "/rides",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      await markTimedOut();
      const requestedStatus = String(req.query.status ?? "");
      const status = requestedStatus === "accepted" ? "approved" : requestedStatus;
      const q = String(req.query.q ?? "").trim().toLowerCase();
      const result = await pool.query(
        `${rideListSql}
         WHERE r.organization_id = $1
           AND ($2 = '' OR r.status = $2)
           AND (
             $3 = ''
             OR lower(c.first_name || ' ' || c.last_name || ' ' || r.pickup_address || ' ' || r.destination_address) LIKE '%' || $3 || '%'
           )
         ORDER BY r.requested_pickup_at`,
        [req.auth?.organizationId, status, q],
      );
      res.json({ rides: result.rows.map((row) => shapeRide(row as Record<string, unknown>)) });
    }),
  );

  app.get(
    "/rides/:id",
    requireAuth(),
    asyncRoute(async (req, res) => {
      await markTimedOut();
      const ride = await presentRide(pool, param(req, "id"));
      if (!ride) {
        res.status(404).json({ message: "Ride not found." });
        return;
      }
      const auth = req.auth;
      const allowed =
        (auth?.kind === "staff" && auth.organizationId === ride.organization_id) ||
        (auth?.kind === "driver" && ride.driver_id === auth.sub) ||
        (auth?.kind === "driver" && ride.status === "requested");
      if (!allowed) {
        res.status(403).json({ message: "You cannot view this ride." });
        return;
      }
      res.json({ ride });
    }),
  );

  app.post(
    "/rides",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const orgId = req.auth?.organizationId ?? "";
      const staffId = req.auth?.sub ?? "";
      const clientId = String(req.body.client_id ?? "");
      const pickupId = String(req.body.pickup_destination_id ?? "");
      const destinationId = String(req.body.destination_id ?? "");
      const pickupAt = String(req.body.requested_pickup_at ?? "");
      const passengers = Number(req.body.passenger_count);
      const tripType = String(req.body.trip_type ?? "one_way");
      const returnAt = String(req.body.return_pickup_at ?? "");
      if (!clientId || !pickupId || !destinationId || !pickupAt || !Number.isFinite(passengers) || passengers < 1) {
        res.status(400).json({ message: "Client, pickup, destination, pickup time, and passenger count are required." });
        return;
      }
      if (tripType === "round_trip" && !returnAt) {
        res.status(400).json({ message: "Round trips need a return pickup time." });
        return;
      }
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        const client = await db.query(
          `SELECT id, first_name FROM clients WHERE id = $1 AND organization_id = $2`,
          [clientId, orgId],
        );
        const pickup = await db.query(
          `SELECT id, name, address, latitude, longitude FROM addresses
           WHERE id = $1 AND organization_id = $2 AND is_active`,
          [pickupId, orgId],
        );
        const destination = await db.query(
          `SELECT id, name, address, latitude, longitude FROM addresses
           WHERE id = $1 AND organization_id = $2 AND is_active`,
          [destinationId, orgId],
        );
        const pickupRow = pickup.rows[0] as { name: string; address: string; latitude: number; longitude: number } | undefined;
        const destinationRow = destination.rows[0] as { id: string; name: string; address: string; latitude: number; longitude: number } | undefined;
        if (!client.rows[0] || !pickupRow || !destinationRow) {
          await db.query("ROLLBACK");
          res.status(400).json({ message: "Choose an active client and address-book locations." });
          return;
        }
        const needList = needs(req.body.accessibility_needs);
        const notes = String(req.body.notes ?? "").trim();
        const group = tripType === "round_trip";
        const inserted = await db.query(
          `INSERT INTO ride_requests (
             client_id, requested_by_staff_id, organization_id,
             pickup_address, pickup_lat, pickup_lng,
             destination_id, destination_address, destination_lat, destination_lng,
             requested_pickup_at, passenger_count, accessibility_needs, notes,
             status, ride_option, trip_leg, trip_group_id
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NULLIF($14,''),'requested','free','outbound',
             CASE WHEN $15 THEN gen_random_uuid() ELSE NULL END
           )
           RETURNING id, trip_group_id`,
          [
            clientId, staffId, orgId,
            pickupRow.address, pickupRow.latitude, pickupRow.longitude,
            destinationRow.id, destinationRow.address, destinationRow.latitude, destinationRow.longitude,
            pickupAt, passengers, needList, notes, group,
          ],
        );
        const outbound = inserted.rows[0] as { id: string; trip_group_id: string | null };
        const ids = [outbound.id];
        if (group && outbound.trip_group_id) {
          const inbound = await db.query(
            `INSERT INTO ride_requests (
               client_id, requested_by_staff_id, organization_id,
               pickup_address, pickup_lat, pickup_lng,
               destination_id, destination_address, destination_lat, destination_lng,
               requested_pickup_at, passenger_count, accessibility_needs, notes,
               status, ride_option, trip_leg, trip_group_id, linked_ride_id
             ) VALUES (
               $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NULLIF($14,''),'requested','free','return',$15,$16
             ) RETURNING id`,
            [
              clientId, staffId, orgId,
              destinationRow.address, destinationRow.latitude, destinationRow.longitude,
              pickupId, pickupRow.address, pickupRow.latitude, pickupRow.longitude,
              returnAt, passengers, needList, notes, outbound.trip_group_id, outbound.id,
            ],
          );
          const returnId = (inbound.rows[0] as { id: string }).id;
          await db.query(`UPDATE ride_requests SET linked_ride_id = $2 WHERE id = $1`, [outbound.id, returnId]);
          ids.push(returnId);
        }
        for (const id of ids) await notifyStaff(db, id, "Ride booked");
        await db.query("COMMIT");
        const rides = [];
        for (const id of ids) {
          const ride = await presentRide(pool, id);
          if (ride) rides.push(ride);
        }
        res.status(201).json({ rides });
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      } finally {
        db.release();
      }
    }),
  );

  app.post(
    "/rides/:id/cancel",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const reason = String(req.body.reason ?? "").trim();
      if (!reason) {
        res.status(400).json({ message: "A cancellation reason is required." });
        return;
      }
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        const updated = await db.query(
          `UPDATE ride_requests
           SET status = 'cancelled', cancelled_reason = $3, updated_at = now()
           WHERE id = $1 AND organization_id = $2 AND status IN ('requested', 'approved')
           RETURNING id`,
          [param(req, "id"), req.auth?.organizationId, reason],
        );
        if (!updated.rows[0]) {
          await db.query("ROLLBACK");
          res.status(409).json({ message: "This ride can no longer be cancelled." });
          return;
        }
        await db.query(
          `UPDATE dispatches SET response = 'expired', responded_at = now()
           WHERE ride_request_id = $1 AND response = 'accepted'`,
          [param(req, "id")],
        );
        await notifyStaff(db, param(req, "id"), "Ride cancelled");
        await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      } finally {
        db.release();
      }
      res.json({ ride: await presentRide(pool, param(req, "id")) });
    }),
  );

  app.get(
    "/drivers/me/rides/available",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      await markTimedOut();
      await markTimedOut();
      const result = await pool.query(
        `${rideListSql} WHERE ${eligibleSql.replaceAll("$DRIVER", "$1")} ORDER BY r.requested_pickup_at`,
        [req.auth?.sub],
      );
      res.json({ rides: result.rows.map(row => shapeRide(row as Record<string, unknown>)) });
    }),
  );

  app.get(
    "/drivers/me/rides",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        `${rideListSql} WHERE r.driver_id = $1 ORDER BY r.requested_pickup_at`,
        [req.auth?.sub],
      );
      res.json({ rides: result.rows.map((row) => shapeRide(row as Record<string, unknown>)) });
    }),
  );

  app.post(
    "/rides/:id/accept",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const driverId = req.auth?.sub ?? "";
      const rideId = param(req, "id");
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        const locked = await db.query(
          `SELECT status, driver_id, requested_pickup_at FROM ride_requests WHERE id = $1 FOR UPDATE`,
          [rideId],
        );
        const current = locked.rows[0] as { status: string; driver_id: string | null; requested_pickup_at: Date } | undefined;
        if (!current) {
          await db.query("ROLLBACK");
          res.status(404).json({ message: "Ride not found." });
          return;
        }
        if (current.status !== "requested" || current.driver_id) {
          await db.query("ROLLBACK");
          res.status(409).json({ message: "Already assigned" });
          return;
        }
        if (current.requested_pickup_at.getTime() <= Date.now()) {
          await db.query(
            `UPDATE ride_requests SET status = 'timed_out', updated_at = now() WHERE id = $1`,
            [rideId],
          );
          await db.query("COMMIT");
          res.status(409).json({ message: "This ride timed out." });
          return;
        }
        const claimed = await db.query(
          `UPDATE ride_requests r
           SET status = 'approved', driver_id = $2, approved_at = now(), updated_at = now()
           WHERE r.id = $1
             AND r.status = 'requested'
             AND r.driver_id IS NULL
             AND ${eligibleSql.replaceAll("$DRIVER", "$2")}
           RETURNING id`,
          [rideId, driverId],
        );
        if (!claimed.rows[0]) {
          await db.query("ROLLBACK");
          res.status(403).json({ message: "You are not eligible for this ride." });
          return;
        }
        await db.query(
          `INSERT INTO dispatches (ride_request_id, driver_id, response, responded_at)
           VALUES ($1, $2, 'accepted', now())`,
          [rideId, driverId],
        );
        await notifyStaff(db, rideId, "Driver assigned");
        await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK");
        const code = (error as { code?: string }).code;
        if (code === "23505") {
          res.status(409).json({ message: "Already assigned" });
          return;
        }
        throw error;
      } finally {
        db.release();
      }
      res.json({ ride: await presentRide(pool, rideId) });
    }),
  );

  async function driverMove(
    req: AuthedRequest,
    res: Response,
    from: string,
    changes: string,
  ) {
    const result = await pool.query(
      `UPDATE ride_requests
       SET ${changes}, updated_at = now()
       WHERE id = $1 AND driver_id = $2 AND status = $3
       RETURNING id`,
      [param(req, "id"), req.auth?.sub, from],
    );
    if (!result.rows[0]) {
      res.status(409).json({ message: "That ride is not ready for this action." });
      return;
    }
    res.json({ ride: await presentRide(pool, param(req, "id")) });
  }

  app.post(
    "/rides/:id/pickup",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      await driverMove(req, res, "approved", "status = 'in_progress', is_client_picked_up = true");
    }),
  );

  app.post(
    "/rides/:id/dropoff",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        const result = await db.query(
          `UPDATE ride_requests
           SET status = 'completed', is_client_dropped_off = true, completed_at = now(), updated_at = now()
           WHERE id = $1 AND driver_id = $2 AND status = 'in_progress' AND is_client_picked_up
           RETURNING id`,
          [param(req, "id"), req.auth?.sub],
        );
        if (!result.rows[0]) {
          await db.query("ROLLBACK");
          res.status(409).json({ message: "That ride is not ready for this action." });
          return;
        }
        await notifyStaff(db, param(req, "id"), "Ride completed");
        await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      } finally {
        db.release();
      }
      res.json({ ride: await presentRide(pool, param(req, "id")) });
    }),
  );

  app.post(
    "/rides/:id/no-show",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const reason = String(req.body.reason ?? "Client did not appear.").trim();
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        const result = await db.query(
          `UPDATE ride_requests
           SET status = 'no_show', cancelled_reason = $3, updated_at = now()
           WHERE id = $1 AND driver_id = $2 AND status = 'approved'
           RETURNING id`,
          [param(req, "id"), req.auth?.sub, reason],
        );
        if (!result.rows[0]) {
          await db.query("ROLLBACK");
          res.status(409).json({ message: "That ride is not ready for this action." });
          return;
        }
        await notifyStaff(db, param(req, "id"), "Ride no-show");
        await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      } finally {
        db.release();
      }
      res.json({ ride: await presentRide(pool, param(req, "id")) });
    }),
  );

  app.post(
    "/rides/:id/withdraw",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const reason = String(req.body.reason ?? "").trim();
      if (!reason) {
        res.status(400).json({ message: "A reason is required." });
        return;
      }
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        const result = await db.query(
          `UPDATE ride_requests
           SET status = 'requested', driver_id = NULL, approved_at = NULL, approved_by_user_id = NULL,
               cancelled_reason = $3, updated_at = now()
           WHERE id = $1 AND driver_id = $2 AND status = 'approved'
           RETURNING id`,
          [param(req, "id"), req.auth?.sub, reason],
        );
        if (!result.rows[0]) {
          await db.query("ROLLBACK");
          res.status(409).json({ message: "Only an approved ride can be released." });
          return;
        }
        await db.query(
          `UPDATE dispatches SET response = 'expired', responded_at = now()
           WHERE ride_request_id = $1 AND driver_id = $2 AND response = 'accepted'`,
          [param(req, "id"), req.auth?.sub],
        );
        await notifyStaff(db, param(req, "id"), "Driver released ride");
        await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      } finally {
        db.release();
      }
      res.json({ ride: await presentRide(pool, param(req, "id")) });
    }),
  );

  app.post(
    "/drivers/register",
    asyncRoute(async (req, res) => {
      const full = String(req.body.name ?? "").trim();
      const first = String(req.body.first_name ?? full.split(" ")[0] ?? "").trim();
      const last = String(req.body.last_name ?? full.split(" ").slice(1).join(" ") ?? "").trim();
      const dob = String(req.body.dob ?? "").trim();
      const email = String(req.body.email ?? "").trim().toLowerCase();
      const phone = String(req.body.phone ?? "").trim();
      const password = String(req.body.password ?? "");
      const plate = String(req.body.plate ?? "").trim().slice(0, 8);
      const seats = Number(req.body.seats);
      const make = String(req.body.make ?? "").trim();
      const model = String(req.body.model ?? "").trim();
      if (!first || !last || !dob || !email || !phone || password.length < 8 || !plate || !make || !model || !Number.isFinite(seats) || seats < 1) {
        res.status(400).json({ message: "First name, last name, date of birth, contact, vehicle, and a password of at least 8 characters are required." });
        return;
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const db = await pool.connect();
      try {
        await db.query("BEGIN");
        const driver = await db.query(
          `INSERT INTO drivers (first_name, last_name, dob, email, phone, password_hash)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING id, first_name, last_name, email, phone, dob::text`,
          [first, last, dob, email, phone, passwordHash],
        );
        const row = driver.rows[0] as { id: string; first_name: string; last_name: string; email: string; phone: string };
        await db.query(
          `INSERT INTO vehicles (driver_id, make, model, plate_number, seats, wheelchair_accessible)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [row.id, make, model, plate, seats, Boolean(req.body.wheelchair_accessible)],
        );
        await db.query("COMMIT");
        const auth: Auth = { sub: row.id, kind: "driver", role: "driver" };
        res.status(201).json({
          token: sign(auth),
          user: { ...row, name: `${row.first_name} ${row.last_name}`, kind: "driver", role: "driver" },
        });
      } catch (error) {
        await db.query("ROLLBACK");
        if ((error as { code?: string }).code === "23505") {
          res.status(409).json({ message: "That email is already in use." });
          return;
        }
        throw error;
      } finally {
        db.release();
      }
    }),
  );

  app.get(
    "/drivers/me/verifications",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        `SELECT v.id, v.driver_id, v.approved_by_org_id, v.approved_by_staff_id, v.document_type,
                v.document_filename, v.expires_on::text, v.status, v.reviewed_at, v.reject_reason,
                o.name AS organization_name
         FROM driver_verifications v
         JOIN organizations o ON o.id = v.approved_by_org_id
         WHERE v.driver_id = $1
         ORDER BY v.reviewed_at DESC NULLS FIRST`,
        [req.auth?.sub],
      );
      res.json({
        verifications: result.rows.map((row) => ({ ...row, reviewed_at: iso(row.reviewed_at) })),
      });
    }),
  );

  app.post(
    "/drivers/me/verifications",
    requireAuth("driver"),
    upload.single("document"),
    asyncRoute(async (req, res) => {
      const orgId = String(req.body.organization_id ?? "");
      const documentType = String(req.body.check_type ?? req.body.document_type ?? "identity").trim();
      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "Upload a document." });
        return;
      }
      const org = await pool.query(`SELECT id FROM organizations WHERE id = $1`, [orgId]);
      if (!org.rows[0]) {
        res.status(400).json({ message: "Choose the organization that should approve you." });
        return;
      }
      const result = await pool.query(
        `INSERT INTO driver_verifications
           (driver_id, approved_by_org_id, document_type, document, document_filename, expires_on, status)
         VALUES ($1,$2,$3,$4,$5, NULLIF($6,'')::date, 'pending')
         RETURNING id, status, document_type, document_filename, expires_on::text`,
        [
          req.auth?.sub,
          orgId,
          documentType,
          file.buffer,
          file.originalname,
          String(req.body.expires_on ?? ""),
        ],
      );
      res.status(201).json({ verification: result.rows[0] });
    }),
  );

  app.get(
    "/drivers/me/availability",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        `SELECT id, driver_id,
                ST_Y(centre::geometry) AS centre_lat,
                ST_X(centre::geometry) AS centre_lng,
                radius_m, radius_m / 1000 AS radius_km,
                is_active, kind, start_time::text, end_time::text, timezone,
                on_date::text, weekdays, month_days, starts_on::text, ends_on::text, note
         FROM driver_availabilities
         WHERE driver_id = $1
         ORDER BY start_time`,
        [req.auth?.sub],
      );
      res.json({
        availability: result.rows.map((row) => ({
          ...row,
          start_time: clock(row.start_time),
          end_time: clock(row.end_time),
        })),
      });
    }),
  );

  app.post(
    "/drivers/me/availability",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const kind = String(req.body.kind ?? "");
      const start = String(req.body.start_time ?? "");
      const end = String(req.body.end_time ?? "");
      const lat = Number(req.body.centre_lat);
      const lng = Number(req.body.centre_lng);
      const radiusKm = Number(req.body.radius_km);
      if (!["one_time", "weekly", "monthly"].includes(kind) || !start || !end || end <= start) {
        res.status(400).json({ message: "Choose a schedule and an end time after the start time." });
        return;
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusKm) || radiusKm <= 0) {
        res.status(400).json({ message: "Drop a service-area pin and enter a radius in kilometres." });
        return;
      }
      const weekdays = Array.isArray(req.body.weekdays) ? req.body.weekdays.map(Number) : [];
      const monthDays = Array.isArray(req.body.month_days) ? req.body.month_days.map(Number) : [];
      const onDate = String(req.body.on_date ?? "");
      if (kind === "one_time" && !onDate) {
        res.status(400).json({ message: "One-time availability needs a date." });
        return;
      }
      if (kind === "weekly" && weekdays.length === 0) {
        res.status(400).json({ message: "Weekly availability needs at least one weekday." });
        return;
      }
      if (kind === "monthly" && monthDays.length === 0) {
        res.status(400).json({ message: "Monthly availability needs at least one day of the month." });
        return;
      }
      const result = await pool.query(
        `INSERT INTO driver_availabilities
           (driver_id, centre, radius_m, kind, start_time, end_time, timezone, on_date, weekdays, month_days, note)
         VALUES (
           $1,
           ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
           $4, $5, $6, $7, 'America/Vancouver',
           NULLIF($8, '')::date,
           $9::smallint[],
           $10::smallint[],
           NULLIF($11, '')
         )
         RETURNING id, radius_m`,
        [
          req.auth?.sub,
          lng,
          lat,
          radiusKm * 1000,
          kind,
          start,
          end,
          kind === "one_time" ? onDate : "",
          kind === "weekly" ? weekdays : null,
          kind === "monthly" ? monthDays : null,
          String(req.body.note ?? ""),
        ],
      );
      res.status(201).json({ availability: result.rows[0] });
    }),
  );

  app.patch(
    "/drivers/me/availability/:id",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        `UPDATE driver_availabilities
         SET is_active = $3
         WHERE id = $1 AND driver_id = $2
         RETURNING id, is_active`,
        [param(req, "id"), req.auth?.sub, Boolean(req.body.is_active)],
      );
      if (!result.rows[0]) {
        res.status(404).json({ message: "Availability not found." });
        return;
      }
      res.json({ availability: result.rows[0] });
    }),
  );

  app.delete(
    "/drivers/me/availability/:id",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        `DELETE FROM driver_availabilities WHERE id = $1 AND driver_id = $2`,
        [param(req, "id"), req.auth?.sub],
      );
      if (!result.rowCount) {
        res.status(404).json({ message: "Availability not found." });
        return;
      }
      res.json({ ok: true });
    }),
  );

  app.get(
    "/admin/verifications",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        `SELECT v.id, v.driver_id, v.approved_by_org_id, v.document_type, v.document_filename,
                v.expires_on::text, v.status, v.reviewed_at, v.reject_reason,
                d.first_name || ' ' || d.last_name AS driver_name,
                d.email AS driver_email, d.phone AS driver_phone,
                veh.make, veh.model, veh.plate_number, veh.seats, veh.wheelchair_accessible
         FROM driver_verifications v
         JOIN drivers d ON d.id = v.driver_id
         LEFT JOIN LATERAL (
           SELECT make, model, plate_number, seats, wheelchair_accessible
           FROM vehicles WHERE driver_id = d.id LIMIT 1
         ) veh ON true
         WHERE v.approved_by_org_id = $1
         ORDER BY v.status, v.reviewed_at DESC NULLS FIRST`,
        [req.auth?.organizationId],
      );
      res.json({
        verifications: result.rows.map((row) => ({
          ...row,
          reviewed_at: iso(row.reviewed_at),
          vehicle: row.plate_number
            ? {
                make: row.make,
                model: row.model,
                plate: row.plate_number,
                seats: row.seats,
                wheelchair_accessible: row.wheelchair_accessible,
              }
            : null,
        })),
      });
    }),
  );

  app.post(
    "/admin/verifications/:id/approve",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        `UPDATE driver_verifications
         SET status = 'approved', approved_by_staff_id = $3, reviewed_at = now()
         WHERE id = $1 AND approved_by_org_id = $2
         RETURNING id, status, reviewed_at`,
        [param(req, "id"), req.auth?.organizationId, req.auth?.sub],
      );
      if (!result.rows[0]) {
        res.status(404).json({ message: "Verification not found." });
        return;
      }
      res.json({ verification: { ...result.rows[0], reviewed_at: iso(result.rows[0].reviewed_at) } });
    }),
  );

  app.post(
    "/admin/verifications/:id/reject",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const reason = String(req.body.reason ?? "").trim();
      if (!reason) {
        res.status(400).json({ message: "A rejection reason is required." });
        return;
      }
      const result = await pool.query(
        `UPDATE driver_verifications
         SET status = 'rejected', approved_by_staff_id = $3, reviewed_at = now(), reject_reason = $4
         WHERE id = $1 AND approved_by_org_id = $2
         RETURNING id, status, reject_reason, reviewed_at`,
        [param(req, "id"), req.auth?.organizationId, req.auth?.sub, reason],
      );
      if (!result.rows[0]) {
        res.status(404).json({ message: "Verification not found." });
        return;
      }
      res.json({ verification: { ...result.rows[0], reviewed_at: iso(result.rows[0].reviewed_at) } });
    }),
  );

  app.get(
    "/admin/verifications/:id/document",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        `SELECT document, document_filename FROM driver_verifications
         WHERE id = $1 AND approved_by_org_id = $2`,
        [param(req, "id"), req.auth?.organizationId],
      );
      const row = result.rows[0] as { document: Buffer; document_filename: string | null } | undefined;
      if (!row) {
        res.status(404).json({ message: "No uploaded document." });
        return;
      }
      res.setHeader("Content-Disposition", `inline; filename="${row.document_filename ?? "document"}"`);
      res.type("application/octet-stream").send(row.document);
    }),
  );

  app.get(
    "/notifications",
    requireAuth(),
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        `SELECT id, staff_id, ride_request_id, title, message, action_url, channel, metadata, is_read, created_at
         FROM notifications
         WHERE ${req.auth?.kind === 'driver' ? 'driver_id' : 'staff_id'} = $1
         ORDER BY created_at DESC`,
        [req.auth?.sub],
      );
      res.json({
        notifications: result.rows.map((row) => ({
          ...row,
          created_at: iso(row.created_at),
          sent_at: iso(row.created_at),
          type: row.metadata?.type ?? "ride_updated",
          read_at: row.is_read ? iso(row.created_at) : null,
        })),
      });
    }),
  );

  app.post(
    "/notifications/:id/read",
    requireAuth(),
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        `UPDATE notifications SET is_read = true
         WHERE id = $1 AND ${req.auth?.kind === 'driver' ? 'driver_id' : 'staff_id'} = $2
         RETURNING id, is_read`,
        [param(req, "id"), req.auth?.sub],
      );
      if (!result.rows[0]) {
        res.status(404).json({ message: "Notification not found." });
        return;
      }
      res.json({ notification: result.rows[0] });
    }),
  );

  app.get(
    "/admin/demo-summary",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const result = await pool.query(
        `SELECT count(*)::int AS completed_rides
         FROM ride_requests
         WHERE organization_id = $1 AND status = 'completed'`,
        [req.auth?.organizationId],
      );
      const completed = (result.rows[0] as { completed_rides: number }).completed_rides;
      res.json({
        label: "Sample data",
        completed_rides: completed,
        distance_km: completed * 6.5,
        minutes_saved: completed * 20,
        estimated_cost_saved: completed * 28,
        staff_minutes_spent: completed * 15,
      });
    }),
  );

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  });
}

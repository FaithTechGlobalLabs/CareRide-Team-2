import fs from "node:fs";
import path from "node:path";

import bcrypt from "bcrypt";
import type { NextFunction, Request, Response } from "express";
import type { Express } from "express";
import jwt from "jsonwebtoken";
import multer from "multer";

import { driverCanClaim } from "../store/eligibility.js";
import {
  newId,
  readDb,
  update,
  uploadsDir,
  type Db,
} from "../store/jsonStore.js";
import type {
  Driver,
  DriverAvailability,
  Vehicle,
} from "../types/driver.types.js";
import type { NotificationType } from "../types/notification.types.js";
import type {
  Destination,
  OrganizationType,
} from "../types/organization.types.js";
import type { RideRequest } from "../types/ride.types.js";
import type { Client, Staff } from "../types/user.types.js";

const secret = process.env.JWT_SECRET || "careride-dev-secret";

interface Auth {
  sub: string;
  kind: "staff" | "driver";
  role: string;
  organizationId?: string;
}

interface AuthedRequest extends Request {
  auth?: Auth;
}

const upload = multer({ dest: uploadsDir() });

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
        res
          .status(403)
          .json({ message: "This account cannot open that page." });
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

function failure(value: object): { error: string; status: number } | null {
  if (!("error" in value) || !("status" in value)) return null;
  const row = value as { error: unknown; status: unknown };
  if (typeof row.error !== "string" || typeof row.status !== "number")
    return null;
  return { error: row.error, status: row.status };
}

function param(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function publicStaff(staff: Staff) {
  return {
    id: staff.id,
    organization_id: staff.organization_id,
    name: staff.name,
    email: staff.email,
    phone: staff.phone,
    role: staff.role,
    is_active: staff.is_active,
  };
}

function publicDriver(driver: Driver, vehicle?: Vehicle) {
  return {
    id: driver.id,
    name: driver.name,
    dob: driver.dob,
    email: driver.email,
    phone: driver.phone,
    organization_id: driver.organization_id ?? null,
    license_verified: driver.license_verified,
    vehicle: vehicle ?? null,
  };
}

function notify(db: Db, ride: RideRequest, type: NotificationType): void {
  const staff = db.staff.find((row) => row.id === ride.requested_by_user_id);
  const note = {
    id: newId("note"),
    ride_request_id: ride.id,
    recipient_user_id: ride.requested_by_user_id,
    recipient: "staff" as const,
    channel: "in_app" as const,
    type,
    status: "sent" as const,
    sent_at: new Date().toISOString(),
  };
  db.notifications.unshift(
    staff?.email ? { ...note, destination: staff.email } : note,
  );
}

function presentRide(db: Db, ride: RideRequest) {
  const client = db.clients.find((row) => row.id === ride.client_id);
  const driver = db.drivers.find((row) => row.id === ride.driver_id);
  const vehicle = db.vehicles.find((row) => row.driver_id === driver?.id);
  return {
    ...ride,
    client_name: client
      ? `${client.first_name} ${client.last_name}`
      : "Unknown client",
    driver_name: driver?.name ?? null,
    driver_phone: driver?.phone ?? null,
    vehicle: vehicle
      ? {
          make: vehicle.make,
          model: vehicle.model,
          plate: vehicle.plate,
          seats: vehicle.seats,
        }
      : null,
  };
}

function applySampleMetrics(ride: RideRequest): void {
  ride.sample = true;
  ride.distance_km = ride.distance_km ?? 6.5;
  ride.duration_minutes = ride.duration_minutes ?? 20;
  ride.estimated_cost_saved = ride.estimated_cost_saved ?? 28;
  ride.staff_minutes_spent = ride.staff_minutes_spent ?? 15;
}

export function registerApi(app: Express): void {
  app.post(
    "/auth/login",
    asyncRoute(async (req, res) => {
      const email = String(req.body.email ?? "")
        .trim()
        .toLowerCase();
      const password = String(req.body.password ?? "");
      const db = readDb();
      const staff = db.staff.find(
        (row) => row.email.toLowerCase() === email && row.is_active,
      );
      if (staff && (await bcrypt.compare(password, staff.password_hash))) {
        const org = db.organizations.find(
          (row) => row.id === staff.organization_id,
        );
        const auth: Auth = {
          sub: staff.id,
          kind: "staff",
          role: staff.role,
          organizationId: staff.organization_id,
        };
        res.json({
          token: sign(auth),
          user: {
            ...publicStaff(staff),
            kind: "staff",
            organization_name: org?.name ?? "",
            organization_type: org?.type ?? null,
          },
        });
        return;
      }
      const driver = db.drivers.find(
        (row) => row.email.toLowerCase() === email,
      );
      if (driver && (await bcrypt.compare(password, driver.password_hash))) {
        const auth: Auth = { sub: driver.id, kind: "driver", role: "driver" };
        if (driver.organization_id)
          auth.organizationId = driver.organization_id;
        res.json({
          token: sign(auth),
          user: {
            ...publicDriver(
              driver,
              db.vehicles.find((row) => row.driver_id === driver.id),
            ),
            kind: "driver",
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
      const db = readDb();
      if (auth.kind === "staff") {
        const staff = db.staff.find((row) => row.id === auth.sub);
        if (!staff) {
          res.status(401).json({ message: "Login required." });
          return;
        }
        const org = db.organizations.find(
          (row) => row.id === staff.organization_id,
        );
        res.json({
          user: {
            ...publicStaff(staff),
            kind: "staff",
            organization_name: org?.name ?? "",
            organization_type: org?.type ?? null,
          },
        });
        return;
      }
      const driver = db.drivers.find((row) => row.id === auth.sub);
      if (!driver) {
        res.status(401).json({ message: "Login required." });
        return;
      }
      res.json({
        user: {
          ...publicDriver(
            driver,
            db.vehicles.find((row) => row.driver_id === driver.id),
          ),
          kind: "driver",
        },
      });
    }),
  );

  app.get("/organizations", (_req, res) => {
    const db = readDb();
    res.json({
      organizations: db.organizations
        .filter((row) => row.status === "active")
        .map((row) => ({ id: row.id, name: row.name, type: row.type })),
    });
  });

  app.post(
    "/organizations/register",
    asyncRoute(async (req, res) => {
      const name = String(req.body.name ?? "").trim();
      const type = String(req.body.type ?? "") as OrganizationType;
      const address = String(req.body.address ?? "").trim();
      const contactName = String(req.body.contact_name ?? "").trim();
      const email = String(req.body.email ?? "")
        .trim()
        .toLowerCase();
      const phone = String(req.body.phone ?? "").trim();
      const adminName = String(req.body.admin_name ?? "").trim();
      const adminEmail = String(req.body.admin_email ?? "")
        .trim()
        .toLowerCase();
      const adminPassword = String(req.body.admin_password ?? "");
      const adminPhone = String(req.body.admin_phone ?? phone).trim();
      if (
        !name ||
        !address ||
        !contactName ||
        !email ||
        !phone ||
        !adminName ||
        !adminEmail ||
        adminPassword.length < 8
      ) {
        res
          .status(400)
          .json({
            message:
              "Fill in the organization and a password of at least 8 characters.",
          });
        return;
      }
      if (type !== "partner_org" && type !== "transport_provider") {
        res
          .status(400)
          .json({
            message: "Choose partner organization or transportation provider.",
          });
        return;
      }
      const created = await update((db) => {
        if (db.organizations.some((row) => row.email.toLowerCase() === email)) {
          return { error: "An organization with this email already exists." };
        }
        if (
          db.staff.some((row) => row.email.toLowerCase() === adminEmail) ||
          db.drivers.some((row) => row.email.toLowerCase() === adminEmail)
        ) {
          return { error: "That administrator email is already in use." };
        }
        const organization = {
          id: newId("org"),
          name,
          type,
          contact_name: contactName,
          email,
          phone,
          address,
          status: "active" as const,
          created_at: new Date().toISOString(),
        };
        const staff: Staff = {
          id: newId("staff"),
          organization_id: organization.id,
          name: adminName,
          email: adminEmail,
          phone: adminPhone,
          password_hash: bcrypt.hashSync(adminPassword, 10),
          role: "admin",
          is_active: true,
        };
        db.organizations.push(organization);
        db.staff.push(staff);
        return { organization, staff };
      });
      if ("error" in created) {
        res.status(409).json({ message: created.error });
        return;
      }
      const auth: Auth = {
        sub: created.staff.id,
        kind: "staff",
        role: "admin",
        organizationId: created.organization.id,
      };
      res.status(201).json({
        token: sign(auth),
        user: {
          ...publicStaff(created.staff),
          kind: "staff",
          organization_name: created.organization.name,
          organization_type: created.organization.type,
        },
      });
    }),
  );

  app.get(
    "/clients",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const orgId = req.auth?.organizationId ?? "";
      const q = String(req.query.q ?? "")
        .trim()
        .toLowerCase();
      const db = readDb();
      const clients = db.clients.filter((row) => {
        if (row.organization_id !== orgId) return false;
        if (!q) return true;
        return `${row.first_name} ${row.last_name}`.toLowerCase().includes(q);
      });
      res.json({ clients });
    }),
  );

  app.post(
    "/clients",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const orgId = req.auth?.organizationId ?? "";
      const first = String(req.body.first_name ?? "").trim();
      const last = String(req.body.last_name ?? "").trim();
      const dob = String(req.body.dob ?? "").trim();
      const notes = String(req.body.notes ?? "").trim();
      if (!first || !last || !dob) {
        res
          .status(400)
          .json({
            message: "First name, last name, and date of birth are required.",
          });
        return;
      }
      if (notes.length > 50) {
        res
          .status(400)
          .json({ message: "Accommodations must be 50 characters or fewer." });
        return;
      }
      const client = await update((db) => {
        const row: Client = {
          id: newId("client"),
          organization_id: orgId,
          first_name: first,
          last_name: last,
          dob,
          has_smartphone: Boolean(req.body.has_smartphone),
          created_at: new Date().toISOString(),
        };
        const address = String(req.body.address ?? "").trim();
        const phone = String(req.body.phone ?? "").trim();
        const email = String(req.body.email ?? "").trim();
        const emergencyName = String(
          req.body.emergency_contact_name ?? "",
        ).trim();
        const emergencyPhone = String(
          req.body.emergency_contact_phone ?? "",
        ).trim();
        if (address) row.address = address;
        if (phone) row.phone = phone;
        if (email) row.email = email;
        if (emergencyName) row.emergency_contact_name = emergencyName;
        if (emergencyPhone) row.emergency_contact_phone = emergencyPhone;
        if (notes) row.notes = notes;
        db.clients.push(row);
        return row;
      });
      res.status(201).json({ client });
    }),
  );

  app.patch(
    "/clients/:id",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const orgId = req.auth?.organizationId ?? "";
      const notes =
        req.body.notes === undefined
          ? undefined
          : String(req.body.notes).trim();
      if (notes && notes.length > 50) {
        res
          .status(400)
          .json({ message: "Accommodations must be 50 characters or fewer." });
        return;
      }
      const client = await update((db) => {
        const row = db.clients.find(
          (item) =>
            item.id === param(req, "id") && item.organization_id === orgId,
        );
        if (!row) return null;
        if (req.body.first_name)
          row.first_name = String(req.body.first_name).trim();
        if (req.body.last_name)
          row.last_name = String(req.body.last_name).trim();
        if (req.body.dob) row.dob = String(req.body.dob).trim();
        if (req.body.address !== undefined)
          row.address = String(req.body.address).trim();
        if (req.body.phone !== undefined)
          row.phone = String(req.body.phone).trim();
        if (req.body.email !== undefined)
          row.email = String(req.body.email).trim();
        if (req.body.emergency_contact_name !== undefined)
          row.emergency_contact_name = String(
            req.body.emergency_contact_name,
          ).trim();
        if (req.body.emergency_contact_phone !== undefined)
          row.emergency_contact_phone = String(
            req.body.emergency_contact_phone,
          ).trim();
        if (notes !== undefined) row.notes = notes;
        if (req.body.has_smartphone !== undefined)
          row.has_smartphone = Boolean(req.body.has_smartphone);
        return row;
      });
      if (!client) {
        res.status(404).json({ message: "Client not found." });
        return;
      }
      res.json({ client });
    }),
  );

  app.get(
    "/destinations",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const orgId = req.auth?.organizationId ?? "";
      const q = String(req.query.q ?? "")
        .trim()
        .toLowerCase();
      const type = String(req.query.type ?? "");
      const db = readDb();
      const destinations = db.destinations.filter((row) => {
        if (row.organization_id !== orgId) return false;
        if (type && row.type !== type) return false;
        if (!q) return true;
        return `${row.name} ${row.address}`.toLowerCase().includes(q);
      });
      res.json({ destinations });
    }),
  );

  app.post(
    "/destinations",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const orgId = req.auth?.organizationId ?? "";
      const name = String(req.body.name ?? "").trim();
      const type = String(req.body.type ?? "");
      const address = String(req.body.address ?? "").trim();
      const lat = Number(req.body.lat);
      const lng = Number(req.body.lng);
      if (
        !name ||
        !address ||
        !["hospital", "shelter", "service"].includes(type)
      ) {
        res
          .status(400)
          .json({ message: "Name, type, and address are required." });
        return;
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        res.status(400).json({ message: "Drop a map pin for this location." });
        return;
      }
      const destination = await update((db) => {
        const row: Destination = {
          id: newId("dest"),
          organization_id: orgId,
          name,
          type: type as Destination["type"],
          address,
          lat,
          lng,
          is_active: req.body.is_active !== false,
        };
        db.destinations.push(row);
        return row;
      });
      res.status(201).json({ destination });
    }),
  );

  app.patch(
    "/destinations/:id",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const orgId = req.auth?.organizationId ?? "";
      const destination = await update((db) => {
        const row = db.destinations.find(
          (item) =>
            item.id === param(req, "id") && item.organization_id === orgId,
        );
        if (!row) return null;
        if (req.body.name) row.name = String(req.body.name).trim();
        if (req.body.address) row.address = String(req.body.address).trim();
        if (
          req.body.type &&
          ["hospital", "shelter", "service"].includes(String(req.body.type))
        ) {
          row.type = req.body.type;
        }
        if (req.body.lat !== undefined && req.body.lng !== undefined) {
          row.lat = Number(req.body.lat);
          row.lng = Number(req.body.lng);
        }
        if (req.body.is_active !== undefined)
          row.is_active = Boolean(req.body.is_active);
        return row;
      });
      if (!destination) {
        res.status(404).json({ message: "Location not found." });
        return;
      }
      res.json({ destination });
    }),
  );

  app.get(
    "/rides",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const orgId = req.auth?.organizationId ?? "";
      const status = String(req.query.status ?? "");
      const q = String(req.query.q ?? "")
        .trim()
        .toLowerCase();
      const db = readDb();
      const rides = db.rides
        .filter((ride) => ride.organization_id === orgId)
        .filter((ride) => !status || ride.status === status)
        .map((ride) => presentRide(db, ride))
        .filter((ride) => {
          if (!q) return true;
          return `${ride.client_name} ${ride.pickup_address} ${ride.destination_address ?? ""}`
            .toLowerCase()
            .includes(q);
        });
      res.json({ rides });
    }),
  );

  app.get(
    "/rides/:id",
    requireAuth(),
    asyncRoute(async (req, res) => {
      const db = readDb();
      const ride = db.rides.find((row) => row.id === param(req, "id"));
      if (!ride) {
        res.status(404).json({ message: "Ride not found." });
        return;
      }
      const auth = req.auth;
      const allowed =
        (auth?.kind === "staff" &&
          auth.organizationId === ride.organization_id) ||
        (auth?.kind === "driver" && ride.driver_id === auth.sub) ||
        (auth?.kind === "driver" && ride.status === "requested");
      if (!allowed) {
        res.status(403).json({ message: "You cannot view this ride." });
        return;
      }
      res.json({ ride: presentRide(db, ride) });
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
      const destinationId = String(
        req.body.destination_destination_id ?? req.body.destination_id ?? "",
      );
      const pickupAt = String(req.body.requested_pickup_at ?? "");
      const passengers = Number(req.body.passenger_count);
      const tripType = String(req.body.trip_type ?? "one_way");
      const returnAt = String(req.body.return_pickup_at ?? "");
      if (
        !clientId ||
        !pickupId ||
        !destinationId ||
        !pickupAt ||
        !Number.isFinite(passengers) ||
        passengers < 1
      ) {
        res
          .status(400)
          .json({
            message:
              "Client, pickup, destination, pickup time, and passenger count are required.",
          });
        return;
      }
      if (tripType === "round_trip" && !returnAt) {
        res
          .status(400)
          .json({ message: "Round trips need a return pickup time." });
        return;
      }
      const result = await update((db) => {
        const client = db.clients.find(
          (row) => row.id === clientId && row.organization_id === orgId,
        );
        const pickup = db.destinations.find(
          (row) =>
            row.id === pickupId &&
            row.organization_id === orgId &&
            row.is_active,
        );
        const destination = db.destinations.find(
          (row) =>
            row.id === destinationId &&
            row.organization_id === orgId &&
            row.is_active,
        );
        if (!client || !pickup || !destination)
          return {
            error: "Choose an active client and address-book locations.",
          };
        const now = new Date().toISOString();
        const needs = Array.isArray(req.body.accessibility_needs)
          ? req.body.accessibility_needs.map(String).join(", ")
          : String(req.body.accessibility_needs ?? "");
        const notes = String(req.body.notes ?? "").trim();
        const urgency = String(req.body.urgency ?? "routine");
        const appointment = String(req.body.appointment_at ?? "").trim();
        const groupId = tripType === "round_trip" ? newId("trip") : undefined;
        const outboundId = newId("ride");
        const returnId = tripType === "round_trip" ? newId("ride") : undefined;
        const outbound: RideRequest = {
          id: outboundId,
          client_id: client.id,
          requested_by_user_id: staffId,
          organization_id: orgId,
          pickup_address: pickup.address,
          pickup_lat: pickup.lat,
          pickup_lng: pickup.lng,
          destination_id: destination.id,
          destination_address: destination.address,
          destination_lat: destination.lat,
          destination_lng: destination.lng,
          requested_pickup_at: pickupAt,
          passenger_count: passengers,
          status: "requested",
          ride_option: "free",
          created_at: now,
          updated_at: now,
          trip_leg: "outbound",
        };
        if (needs) outbound.accessibility_needs = needs;
        if (notes) outbound.notes = notes;
        if (
          urgency === "routine" ||
          urgency === "soon" ||
          urgency === "time_sensitive"
        )
          outbound.urgency = urgency;
        if (appointment) outbound.appointment_at = appointment;
        if (groupId) outbound.trip_group_id = groupId;
        if (returnId) outbound.linked_ride_id = returnId;
        db.rides.unshift(outbound);
        notify(db, outbound, "confirmation");
        const created = [outbound];
        if (returnId && groupId) {
          const inbound: RideRequest = {
            ...outbound,
            id: returnId,
            linked_ride_id: outboundId,
            trip_leg: "return",
            pickup_address: destination.address,
            pickup_lat: destination.lat,
            pickup_lng: destination.lng,
            destination_id: pickup.id,
            destination_address: pickup.address,
            destination_lat: pickup.lat,
            destination_lng: pickup.lng,
            requested_pickup_at: returnAt,
          };
          delete inbound.appointment_at;
          db.rides.unshift(inbound);
          notify(db, inbound, "confirmation");
          created.push(inbound);
        }
        return { rides: created.map((ride) => presentRide(db, ride)) };
      });
      if ("error" in result) {
        res.status(400).json({ message: result.error });
        return;
      }
      res.status(201).json(result);
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
      const orgId = req.auth?.organizationId ?? "";
      const ride = await update((db) => {
        const row = db.rides.find(
          (item) =>
            item.id === param(req, "id") && item.organization_id === orgId,
        );
        if (!row) return { error: "Ride not found.", status: 404 };
        if (row.status === "completed" || row.status === "cancelled") {
          return {
            error: "This ride can no longer be cancelled.",
            status: 409,
          };
        }
        row.status = "cancelled";
        row.cancelled_reason = reason;
        row.updated_at = new Date().toISOString();
        notify(db, row, "cancelled");
        return { ride: presentRide(db, row) };
      });
      const failed = failure(ride);
      if (failed) {
        res.status(failed.status).json({ message: failed.error });
        return;
      }
      res.json(ride);
    }),
  );

  app.get(
    "/drivers/me/rides/available",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const driverId = req.auth?.sub ?? "";
      const db = readDb();
      const driver = db.drivers.find((row) => row.id === driverId);
      const vehicle = db.vehicles.find((row) => row.driver_id === driverId);
      if (!driver) {
        res.status(404).json({ message: "Driver not found." });
        return;
      }
      const rides = db.rides
        .filter((ride) => driverCanClaim(db, driver, vehicle, ride).ok)
        .map((ride) => presentRide(db, ride));
      res.json({ rides });
    }),
  );

  app.get(
    "/drivers/me/rides",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const driverId = req.auth?.sub ?? "";
      const db = readDb();
      const rides = db.rides
        .filter((ride) => ride.driver_id === driverId)
        .map((ride) => presentRide(db, ride));
      res.json({ rides });
    }),
  );

  app.post(
    "/rides/:id/accept",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const driverId = req.auth?.sub ?? "";
      const outcome = await update((db) => {
        const driver = db.drivers.find((row) => row.id === driverId);
        const vehicle = db.vehicles.find((row) => row.driver_id === driverId);
        const ride = db.rides.find((row) => row.id === param(req, "id"));
        if (!driver || !ride) return { error: "Ride not found.", status: 404 };
        const check = driverCanClaim(db, driver, vehicle, ride);
        if (!check.ok)
          return {
            error: check.reason,
            status: check.reason === "Already assigned" ? 409 : 403,
          };
        ride.status = "accepted";
        ride.driver_id = driver.id;
        ride.waiting_minutes = check.availability.max_wait_minutes;
        ride.updated_at = new Date().toISOString();
        notify(db, ride, "driver_assigned");
        return { ride: presentRide(db, ride) };
      });
      const failed = failure(outcome);
      if (failed) {
        res.status(failed.status).json({ message: failed.error });
        return;
      }
      res.json(outcome);
    }),
  );

  function driverTransition(
    pathName: string,
    from: RideRequest["status"],
    to: RideRequest["status"],
    type?: NotificationType,
  ) {
    app.post(
      pathName,
      requireAuth("driver"),
      asyncRoute(async (req, res) => {
        const driverId = req.auth?.sub ?? "";
        const outcome = await update((db) => {
          const ride = db.rides.find((row) => row.id === param(req, "id"));
          if (!ride || ride.driver_id !== driverId)
            return { error: "Ride not found.", status: 404 };
          if (ride.status !== from)
            return { error: `Ride is ${ride.status}.`, status: 409 };
          ride.status = to;
          ride.updated_at = new Date().toISOString();
          if (to === "in_progress") ride.picked_up_at = ride.updated_at;
          if (to === "completed") {
            ride.completed_at = ride.updated_at;
            applySampleMetrics(ride);
          }
          if (to === "no_show") {
            const reason = String(
              req.body.reason ??
                "Client did not appear before the waiting deadline.",
            ).trim();
            ride.cancelled_reason = reason;
          }
          if (type) notify(db, ride, type);
          return { ride: presentRide(db, ride) };
        });
        const failed = failure(outcome);
        if (failed) {
          res.status(failed.status).json({ message: failed.error });
          return;
        }
        res.json(outcome);
      }),
    );
  }

  driverTransition("/rides/:id/pickup", "accepted", "in_progress");
  driverTransition(
    "/rides/:id/dropoff",
    "in_progress",
    "completed",
    "completed",
  );
  driverTransition("/rides/:id/no-show", "accepted", "no_show", "cancelled");

  app.post(
    "/rides/:id/withdraw",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const reason = String(req.body.reason ?? "").trim();
      if (!reason) {
        res.status(400).json({ message: "A reason is required." });
        return;
      }
      const driverId = req.auth?.sub ?? "";
      const outcome = await update((db) => {
        const ride = db.rides.find((row) => row.id === param(req, "id"));
        if (!ride || ride.driver_id !== driverId)
          return { error: "Ride not found.", status: 404 };
        if (ride.status !== "accepted")
          return {
            error: "Only an accepted ride can be released.",
            status: 409,
          };
        ride.status = "requested";
        delete ride.driver_id;
        delete ride.waiting_minutes;
        ride.cancelled_reason = reason;
        ride.updated_at = new Date().toISOString();
        notify(db, ride, "cancelled");
        return { ride: presentRide(db, ride) };
      });
      const failed = failure(outcome);
      if (failed) {
        res.status(failed.status).json({ message: failed.error });
        return;
      }
      res.json(outcome);
    }),
  );

  app.post(
    "/drivers/register",
    asyncRoute(async (req, res) => {
      const name = String(req.body.name ?? "").trim();
      const dob = String(req.body.dob ?? "").trim();
      const email = String(req.body.email ?? "")
        .trim()
        .toLowerCase();
      const phone = String(req.body.phone ?? "").trim();
      const password = String(req.body.password ?? "");
      const plate = String(req.body.plate ?? "")
        .trim()
        .slice(0, 8);
      const seats = Number(req.body.seats);
      const make = String(req.body.make ?? "").trim();
      const model = String(req.body.model ?? "").trim();
      const affiliation = String(req.body.affiliation ?? "independent");
      const organizationId = String(req.body.organization_id ?? "");
      if (
        !name ||
        !dob ||
        !email ||
        !phone ||
        password.length < 8 ||
        !plate ||
        !make ||
        !model ||
        !Number.isFinite(seats) ||
        seats < 1
      ) {
        res
          .status(400)
          .json({
            message:
              "Name, date of birth, contact, vehicle, and a password of at least 8 characters are required.",
          });
        return;
      }
      const created = await update((db) => {
        if (
          db.drivers.some((row) => row.email.toLowerCase() === email) ||
          db.staff.some((row) => row.email.toLowerCase() === email)
        ) {
          return { error: "That email is already in use." };
        }
        if (affiliation === "transport_provider") {
          const org = db.organizations.find(
            (row) =>
              row.id === organizationId && row.type === "transport_provider",
          );
          if (!org) return { error: "Choose a transportation provider." };
        }
        const driver: Driver = {
          id: newId("driver"),
          name,
          dob,
          email,
          phone,
          password_hash: bcrypt.hashSync(password, 10),
          license_verified: false,
        };
        if (affiliation === "transport_provider")
          driver.organization_id = organizationId;
        const vehicle: Vehicle = {
          id: newId("vehicle"),
          driver_id: driver.id,
          make,
          model,
          plate,
          seats,
          wheelchair_accessible: Boolean(req.body.wheelchair_accessible),
        };
        db.drivers.push(driver);
        db.vehicles.push(vehicle);
        return { driver, vehicle };
      });
      if ("error" in created) {
        res.status(409).json({ message: created.error });
        return;
      }
      const auth: Auth = {
        sub: created.driver.id,
        kind: "driver",
        role: "driver",
      };
      if (created.driver.organization_id)
        auth.organizationId = created.driver.organization_id;
      res.status(201).json({
        token: sign(auth),
        user: {
          ...publicDriver(created.driver, created.vehicle),
          kind: "driver",
        },
      });
    }),
  );

  app.get(
    "/drivers/me/verifications",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const driverId = req.auth?.sub ?? "";
      const db = readDb();
      const verifications = db.verifications
        .filter((row) => row.driver_id === driverId)
        .map((row) => ({
          ...row,
          organization_name:
            db.organizations.find((org) => org.id === row.approved_by_org_id)
              ?.name ?? "",
        }));
      res.json({ verifications });
    }),
  );

  app.post(
    "/drivers/me/verifications",
    requireAuth("driver"),
    upload.single("document"),
    asyncRoute(async (req, res) => {
      const driverId = req.auth?.sub ?? "";
      const orgId = String(req.body.organization_id ?? "");
      const checkType = String(req.body.check_type ?? "identity").trim();
      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "Upload a document." });
        return;
      }
      const saved = await update((db) => {
        const org = db.organizations.find(
          (row) =>
            row.id === orgId &&
            row.type === "partner_org" &&
            row.status === "active",
        );
        if (!org) return null;
        const row = {
          id: newId("ver"),
          driver_id: driverId,
          approved_by_org_id: org.id,
          check_type: checkType,
          document_ref: file.filename,
          status: "pending" as const,
        };
        const issued = String(req.body.issued_on ?? "").trim();
        const expires = String(req.body.expires_on ?? "").trim();
        if (issued) Object.assign(row, { issued_on: issued });
        if (expires) Object.assign(row, { expires_on: expires });
        db.verifications.push(row);
        return row;
      });
      if (!saved) {
        res
          .status(400)
          .json({
            message: "Choose the partner organization that should approve you.",
          });
        return;
      }
      res.status(201).json({ verification: saved });
    }),
  );

  app.get(
    "/drivers/me/availability",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const driverId = req.auth?.sub ?? "";
      const db = readDb();
      res.json({
        availability: db.availabilities.filter(
          (row) => row.driver_id === driverId,
        ),
      });
    }),
  );

  app.post(
    "/drivers/me/availability",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const driverId = req.auth?.sub ?? "";
      const kind = String(req.body.kind ?? "");
      const start = String(req.body.start_time ?? "");
      const end = String(req.body.end_time ?? "");
      const lat = Number(req.body.centre_lat);
      const lng = Number(req.body.centre_lng);
      const radius = Number(req.body.radius_km);
      const notice = Number(req.body.minimum_notice_minutes ?? 0);
      const wait = Number(req.body.max_wait_minutes ?? 15);
      if (
        !["one_time", "weekly", "monthly"].includes(kind) ||
        !start ||
        !end ||
        end <= start
      ) {
        res
          .status(400)
          .json({
            message: "Choose a schedule and an end time after the start time.",
          });
        return;
      }
      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        !Number.isFinite(radius) ||
        radius <= 0
      ) {
        res
          .status(400)
          .json({
            message:
              "Drop a service-area pin and enter a radius in kilometres.",
          });
        return;
      }
      const weekdays = Array.isArray(req.body.weekdays)
        ? req.body.weekdays.map(Number)
        : [];
      const monthDays = Array.isArray(req.body.month_days)
        ? req.body.month_days.map(Number)
        : [];
      const onDate = String(req.body.on_date ?? "");
      if (kind === "one_time" && !onDate) {
        res
          .status(400)
          .json({ message: "One-time availability needs a date." });
        return;
      }
      if (kind === "weekly" && weekdays.length === 0) {
        res
          .status(400)
          .json({ message: "Weekly availability needs at least one weekday." });
        return;
      }
      if (kind === "monthly" && monthDays.length === 0) {
        res
          .status(400)
          .json({
            message:
              "Monthly availability needs at least one day of the month.",
          });
        return;
      }
      const row = await update((db) => {
        const availability: DriverAvailability = {
          id: newId("avail"),
          driver_id: driverId,
          centre_lat: lat,
          centre_lng: lng,
          radius_km: radius,
          is_active: true,
          kind: kind as DriverAvailability["kind"],
          start_time: start,
          end_time: end,
          timezone: "America/Vancouver",
          minimum_notice_minutes: notice,
          max_wait_minutes: wait,
        };
        if (kind === "one_time") availability.on_date = onDate;
        if (kind === "weekly") availability.weekdays = weekdays;
        if (kind === "monthly") availability.month_days = monthDays;
        const note = String(req.body.note ?? "").trim();
        if (note) availability.note = note;
        db.availabilities.push(availability);
        return availability;
      });
      res.status(201).json({ availability: row });
    }),
  );

  app.patch(
    "/drivers/me/availability/:id",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const driverId = req.auth?.sub ?? "";
      const row = await update((db) => {
        const availability = db.availabilities.find(
          (item) => item.id === param(req, "id") && item.driver_id === driverId,
        );
        if (!availability) return null;
        if (req.body.is_active !== undefined)
          availability.is_active = Boolean(req.body.is_active);
        return availability;
      });
      if (!row) {
        res.status(404).json({ message: "Availability not found." });
        return;
      }
      res.json({ availability: row });
    }),
  );

  app.delete(
    "/drivers/me/availability/:id",
    requireAuth("driver"),
    asyncRoute(async (req, res) => {
      const driverId = req.auth?.sub ?? "";
      const removed = await update((db) => {
        const index = db.availabilities.findIndex(
          (item) => item.id === param(req, "id") && item.driver_id === driverId,
        );
        if (index < 0) return false;
        db.availabilities.splice(index, 1);
        return true;
      });
      if (!removed) {
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
      const orgId = req.auth?.organizationId ?? "";
      const db = readDb();
      const verifications = db.verifications
        .filter((row) => row.approved_by_org_id === orgId)
        .map((row) => {
          const driver = db.drivers.find((item) => item.id === row.driver_id);
          const vehicle = db.vehicles.find(
            (item) => item.driver_id === row.driver_id,
          );
          return {
            ...row,
            driver_name: driver?.name ?? "",
            driver_email: driver?.email ?? "",
            driver_phone: driver?.phone ?? "",
            vehicle,
          };
        });
      res.json({ verifications });
    }),
  );

  app.post(
    "/admin/verifications/:id/approve",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      if (req.auth?.role !== "admin") {
        res
          .status(403)
          .json({ message: "Only an organization admin can approve drivers." });
        return;
      }
      const orgId = req.auth.organizationId ?? "";
      const reviewer = req.auth.sub;
      const row = await update((db) => {
        const verification = db.verifications.find(
          (item) =>
            item.id === param(req, "id") && item.approved_by_org_id === orgId,
        );
        if (!verification) return null;
        verification.status = "approved";
        verification.approved_by_user_id = reviewer;
        verification.reviewed_at = new Date().toISOString();
        return verification;
      });
      if (!row) {
        res.status(404).json({ message: "Verification not found." });
        return;
      }
      res.json({ verification: row });
    }),
  );

  app.post(
    "/admin/verifications/:id/reject",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      if (req.auth?.role !== "admin") {
        res
          .status(403)
          .json({ message: "Only an organization admin can reject drivers." });
        return;
      }
      const reason = String(req.body.reason ?? "").trim();
      if (!reason) {
        res.status(400).json({ message: "A rejection reason is required." });
        return;
      }
      const orgId = req.auth.organizationId ?? "";
      const reviewer = req.auth.sub;
      const row = await update((db) => {
        const verification = db.verifications.find(
          (item) =>
            item.id === param(req, "id") && item.approved_by_org_id === orgId,
        );
        if (!verification) return null;
        verification.status = "rejected";
        verification.approved_by_user_id = reviewer;
        verification.reviewed_at = new Date().toISOString();
        verification.reject_reason = reason;
        return verification;
      });
      if (!row) {
        res.status(404).json({ message: "Verification not found." });
        return;
      }
      res.json({ verification: row });
    }),
  );

  app.get(
    "/admin/verifications/:id/document",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const orgId = req.auth?.organizationId ?? "";
      const db = readDb();
      const verification = db.verifications.find(
        (item) =>
          item.id === param(req, "id") && item.approved_by_org_id === orgId,
      );
      if (
        !verification?.document_ref ||
        verification.document_ref === "seed-identity.txt"
      ) {
        res.status(404).json({ message: "No uploaded document." });
        return;
      }
      const filePath = path.join(
        uploadsDir(),
        path.basename(verification.document_ref),
      );
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ message: "Document file is missing." });
        return;
      }
      res.sendFile(filePath);
    }),
  );

  app.get(
    "/notifications",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const userId = req.auth?.sub ?? "";
      const db = readDb();
      const notifications = db.notifications.filter(
        (row) => row.recipient_user_id === userId,
      );
      res.json({ notifications });
    }),
  );

  app.post(
    "/notifications/:id/read",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const userId = req.auth?.sub ?? "";
      const row = await update((db) => {
        const note = db.notifications.find(
          (item) =>
            item.id === param(req, "id") && item.recipient_user_id === userId,
        );
        if (!note) return null;
        note.read_at = new Date().toISOString();
        return note;
      });
      if (!row) {
        res.status(404).json({ message: "Notification not found." });
        return;
      }
      res.json({ notification: row });
    }),
  );

  app.get(
    "/admin/demo-summary",
    requireAuth("staff"),
    asyncRoute(async (req, res) => {
      const orgId = req.auth?.organizationId ?? "";
      const db = readDb();
      const completed = db.rides.filter(
        (ride) => ride.organization_id === orgId && ride.status === "completed",
      );
      res.json({
        label: "Sample data",
        completed_rides: completed.length,
        distance_km: completed.reduce(
          (sum, ride) => sum + (ride.distance_km ?? 0),
          0,
        ),
        minutes_saved: completed.reduce(
          (sum, ride) => sum + (ride.duration_minutes ?? 0),
          0,
        ),
        estimated_cost_saved: completed.reduce(
          (sum, ride) => sum + (ride.estimated_cost_saved ?? 0),
          0,
        ),
        staff_minutes_spent: completed.reduce(
          (sum, ride) => sum + (ride.staff_minutes_spent ?? 0),
          0,
        ),
      });
    }),
  );

  app.use(
    (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      console.error(error);
      res.status(500).json({ message: "Internal server error." });
    },
  );
}

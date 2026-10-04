import type {
  Driver,
  DriverAvailability,
  Vehicle,
} from "../types/driver.types.js";
import type { RideRequest } from "../types/ride.types.js";
import type { Db } from "./jsonStore.js";

function kmBetween(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function vancouverParts(iso: string): {
  date: string;
  time: string;
  weekday: number;
  dayOfMonth: number;
} {
  const instant = new Date(iso);
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Vancouver",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Vancouver",
    weekday: "short",
  }).format(instant);
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    date,
    time,
    weekday: weekdays[weekdayName] ?? 0,
    dayOfMonth: Number(date.slice(8, 10)),
  };
}

function availabilityCovers(
  rule: DriverAvailability,
  pickupIso: string,
  now: Date,
): boolean {
  if (!rule.is_active) return false;
  const pickup = new Date(pickupIso);
  if (Number.isNaN(pickup.getTime())) return false;
  if (pickup.getTime() < now.getTime()) return false;

  const parts = vancouverParts(pickupIso);
  if (rule.starts_on && parts.date < rule.starts_on) return false;
  if (rule.ends_on && parts.date > rule.ends_on) return false;
  if (parts.time < rule.start_time || parts.time > rule.end_time) return false;

  if (rule.kind === "one_time") return rule.on_date === parts.date;
  if (rule.kind === "weekly")
    return (rule.weekdays ?? []).includes(parts.weekday);
  return (rule.month_days ?? []).includes(parts.dayOfMonth);
}

export function matchingAvailability(
  db: Db,
  driverId: string,
  ride: RideRequest,
  now = new Date(),
): DriverAvailability | undefined {
  return db.availabilities.find(
    (rule) =>
      rule.driver_id === driverId &&
      availabilityCovers(rule, ride.requested_pickup_at, now) &&
      kmBetween(
        rule.centre_lat,
        rule.centre_lng,
        ride.pickup_lat,
        ride.pickup_lng,
      ) <= rule.radius_m / 1000,
  );
}

export function driverCanClaim(
  db: Db,
  driver: Driver,
  vehicle: Vehicle | undefined,
  ride: RideRequest,
  now = new Date(),
):
  | { ok: true; availability: DriverAvailability }
  | { ok: false; reason: string } {
  if (ride.status !== "requested" || ride.driver_id) {
    return { ok: false, reason: "Already assigned" };
  }
  const approved = db.verifications.some(
    (row) =>
      row.driver_id === driver.id &&
      row.approved_by_org_id === ride.organization_id &&
      row.status === "approved",
  );
  if (!approved) {
    return { ok: false, reason: "This organization has not approved you." };
  }
  if (!vehicle || vehicle.seats < ride.passenger_count) {
    return { ok: false, reason: "Vehicle capacity is too small." };
  }
  const needsWheelchair = ride.accessibility_needs.some((need) =>
    need.toLowerCase().includes("wheelchair"),
  );
  if (needsWheelchair && !vehicle.wheelchair_accessible) {
    return {
      ok: false,
      reason: "This ride needs a wheelchair accessible vehicle.",
    };
  }
  const availability = matchingAvailability(db, driver.id, ride, now);
  if (!availability) {
    return { ok: false, reason: "Outside your availability or service area." };
  }
  return { ok: true, availability };
}

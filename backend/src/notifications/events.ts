import { randomUUID, createHash } from "node:crypto";
import type { Db } from "../store/jsonStore.js";
import { driverCanClaim } from "../store/eligibility.js";
import type {
  Notification,
  NotificationPreference,
} from "../types/notification.types.js";

export function preference(
  db: Db,
  userId: string,
  kind: "staff" | "driver",
): NotificationPreference {
  db.notificationPreferences ??= [];
  let row = db.notificationPreferences.find(
    (p) => p.user_id === userId && p.kind === kind,
  );
  if (!row) {
    row = {
      user_id: userId,
      kind,
      push_enabled: false,
      updates_enabled: true,
      available_rides_enabled: true,
      prompt_after: new Date(Date.now() + 86400000).toISOString(),
      prompt_dismissed: false,
    };
    db.notificationPreferences.push(row);
  }
  return row;
}

function add(
  db: Db,
  note: Omit<Notification, "id" | "channel" | "status" | "sent_at">,
) {
  if (db.notifications.some((n) => n.event_key === note.event_key)) return;
  db.notifications.unshift({
    ...note,
    id: randomUUID(),
    channel: "in_app",
    status: "sent",
    sent_at: new Date().toISOString(),
  });
}

export function reconcileNotifications(before: Db, db: Db): void {
  const oldRides = new Map(before.rides.map((r) => [r.id, r]));
  for (const ride of db.rides) {
    const old = oldRides.get(ride.id);
    const changed = !old || JSON.stringify(old) !== JSON.stringify(ride);
    if (!changed) continue;
    if (
      ride.status === "accepted" &&
      old?.status !== "accepted" &&
      ride.driver_id &&
      db.drivers.some((d) => d.id === ride.driver_id)
    ) {
      const p = preference(db, ride.driver_id, "driver");
      if (!p.first_ride_accepted_at) {
        p.first_ride_accepted_at = new Date().toISOString();
        p.first_ride_prompt_pending =
          !p.prompt_dismissed &&
          !p.push_enabled &&
          (!p.prompt_snoozed_until ||
            p.prompt_snoozed_until <= new Date().toISOString());
      }
    }
    // Replace legacy single-staff notices emitted during this same mutation.
    const oldIds = new Set(before.notifications.map((n) => n.id));
    db.notifications = db.notifications.filter(
      (n) => oldIds.has(n.id) || n.ride_request_id !== ride.id || n.event_key,
    );
    const client = db.clients.find((c) => c.id === ride.client_id);
    const name = client
      ? `${client.first_name} ${client.last_name}`
      : "Your client";
    const title = !old
      ? "Ride booked"
      : ride.status === "requested" && old.driver_id
        ? "Ride available again"
        : ride.status === "accepted"
          ? "Driver assigned"
          : ride.status === "in_progress"
            ? "Client picked up"
            : ride.status === "completed"
              ? "Client arrived"
              : ride.status === "no_show"
                ? "Client did not arrive"
                : ride.status === "cancelled"
                  ? "Ride cancelled"
                  : "Booking updated";
    for (const staff of db.staff.filter(
      (s) => s.is_active && s.organization_id === ride.organization_id,
    )) {
      if (!preference(db, staff.id, "staff").updates_enabled) continue;
      add(db, {
        ride_request_id: ride.id,
        recipient_user_id: staff.id,
        recipient: "staff",
        type: "ride_updated",
        title,
        message: `${name} · ${title.toLowerCase()}`,
        action_url: `/rides/${ride.id}`,
        event_key: `${ride.id}:${createHash("sha256").update(JSON.stringify(ride)).digest("hex")}:${staff.id}`,
      });
    }
  }
  for (const client of db.clients) {
    const old = before.clients.find((c) => c.id === client.id);
    if (!old || JSON.stringify(old) === JSON.stringify(client)) continue;
    const revision = randomUUID();
    for (const staff of db.staff.filter(
      (s) => s.is_active && s.organization_id === client.organization_id,
    )) {
      if (!preference(db, staff.id, "staff").updates_enabled) continue;
      add(db, {
        ride_request_id: "",
        recipient_user_id: staff.id,
        recipient: "staff",
        type: "client_updated",
        title: "Client details updated",
        message: `${client.first_name} ${client.last_name}'s profile has been updated.`,
        action_url: `/clients/${client.id}`,
        event_key: `client:${client.id}:${revision}:${staff.id}`,
      });
    }
  }
  // A change to availability, approval or vehicle can make an existing ride eligible.
  for (const driver of db.drivers) {
    if (!preference(db, driver.id, "driver").available_rides_enabled) continue;
    const vehicle = db.vehicles.find((v) => v.driver_id === driver.id);
    for (const ride of db.rides) {
      if (!driverCanClaim(db, driver, vehicle, ride).ok) continue;
      const location =
        db.destinations.find((d) => d.id === ride.destination_id)?.name ??
        "a community destination";
      add(db, {
        ride_request_id: ride.id,
        recipient_user_id: driver.id,
        recipient: "driver",
        type: "available_ride",
        title: "A ride fits your availability",
        message: `A ride to ${location} is available. View the pickup time and details in CareRide.`,
        action_url: `/rides/${ride.id}`,
        event_key: `available:${ride.id}:${ride.updated_at}:${driver.id}`,
      });
    }
  }
}

import webpush from "web-push";
import { readDb, update } from "../store/jsonStore.js";
import { driverCanClaim } from "../store/eligibility.js";

export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return {
    configured: !!(publicKey && privateKey && subject),
    public_key: publicKey ?? null,
  };
}

let pending: Promise<void> | null = null;
let rerun = false;
export function flushPush(): Promise<void> {
  if (pending) {
    rerun = true;
    return pending;
  }
  pending = (async () => {
    do {
      rerun = false;
      await deliver();
    } while (rerun);
  })().finally(() => {
    pending = null;
  });
  return pending;
}

async function deliver(): Promise<void> {
  if (!pushConfig().configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  await update((db) => {
    db.pushDeliveries ??= [];
    for (const note of db.notifications.filter(
      (n) => n.event_key && !n.read_at,
    )) {
      const prefs = db.notificationPreferences?.find(
        (p) =>
          p.user_id === note.recipient_user_id && p.kind === note.recipient,
      );
      if (
        !prefs?.push_enabled ||
        (note.type === "available_ride"
          ? !prefs.available_rides_enabled
          : !prefs.updates_enabled)
      )
        continue;
      for (const sub of db.pushSubscriptions ?? []) {
        if (
          sub.user_id !== note.recipient_user_id ||
          sub.kind !== note.recipient ||
          sub.created_at > (note.sent_at ?? "")
        )
          continue;
        if (
          !db.pushDeliveries.some(
            (d) => d.notification_id === note.id && d.endpoint === sub.endpoint,
          )
        )
          db.pushDeliveries.push({
            notification_id: note.id,
            endpoint: sub.endpoint,
            attempts: 0,
            next_attempt_at: new Date().toISOString(),
          });
      }
    }
  }, true);
  const snapshot = readDb();
  const due = (snapshot.pushDeliveries ?? [])
    .filter(
      (d) =>
        !d.delivered_at &&
        !d.failed &&
        d.next_attempt_at <= new Date().toISOString(),
    )
    .slice(0, 40);
  for (let i = 0; i < due.length; i += 8) {
    await Promise.all(
      due.slice(i, i + 8).map(async (delivery) => {
        const sub = snapshot.pushSubscriptions?.find(
          (s) => s.endpoint === delivery.endpoint,
        );
        const note = snapshot.notifications.find(
          (n) => n.id === delivery.notification_id,
        );
        const pref = snapshot.notificationPreferences?.find(
          (p) => p.user_id === sub?.user_id && p.kind === sub?.kind,
        );
        let terminal = !sub || !note || !pref?.push_enabled || !!note.read_at;
        if (
          note &&
          sub &&
          (note.recipient_user_id !== sub.user_id ||
            note.recipient !== sub.kind)
        )
          terminal = true;
        if (
          note &&
          (note.type === "available_ride"
            ? !pref?.available_rides_enabled
            : !pref?.updates_enabled)
        )
          terminal = true;
        if (note?.type === "available_ride" && sub) {
          const ride = snapshot.rides.find(
            (r) => r.id === note.ride_request_id,
          );
          const driver = snapshot.drivers.find((d) => d.id === sub.user_id);
          const vehicle = snapshot.vehicles.find(
            (v) => v.driver_id === sub.user_id,
          );
          if (
            !ride ||
            !driver ||
            !driverCanClaim(snapshot, driver, vehicle, ride).ok
          )
            terminal = true;
        }
        let success = false;
        let gone = false;
        if (!terminal && sub && note) {
          try {
            // Lock-screen content stays generic; personal details are behind login.
            await webpush.sendNotification(
              sub,
              JSON.stringify({
                title: "CareRide",
                body:
                  sub.kind === "driver"
                    ? "A ride fits your availability. Open CareRide for details."
                    : "There is an update for your organization. Open CareRide for details.",
                url: "/notifications",
                tag: note.id,
              }),
              { TTL: 3600, timeout: 5000 },
            );
            success = true;
          } catch (error) {
            const code = (error as { statusCode?: number }).statusCode;
            gone = code === 404 || code === 410;
            terminal =
              gone ||
              (code !== undefined && code >= 400 && code < 500 && code !== 429);
          }
        }
        await update((db) => {
          const row = db.pushDeliveries?.find(
            (d) =>
              d.notification_id === delivery.notification_id &&
              d.endpoint === delivery.endpoint,
          );
          if (!row) return;
          row.attempts++;
          if (success) row.delivered_at = new Date().toISOString();
          else if (terminal || row.attempts >= 5) row.failed = true;
          else
            row.next_attempt_at = new Date(
              Date.now() + Math.min(3600000, 30000 * 2 ** row.attempts),
            ).toISOString();
          if (gone)
            db.pushSubscriptions = (db.pushSubscriptions ?? []).filter(
              (s) => s.endpoint !== delivery.endpoint,
            );
        }, true);
      }),
    );
  }
}

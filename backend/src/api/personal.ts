import type {
  Express,
  Request,
  RequestHandler,
  Response,
  NextFunction,
} from "express";
import bcrypt from "bcrypt";
import fs from "node:fs";
import path from "node:path";
import { readDb, update, uploadsDir } from "../store/jsonStore.js";
import { preference } from "../notifications/events.js";
import { pushConfig, flushPush } from "../notifications/push.js";

type PersonalRequest = Request & {
  auth: { sub: string; kind: "staff" | "driver"; organizationId?: string };
};
const route =
  (
    fn: (req: PersonalRequest, res: Response) => Promise<void>,
  ): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    req.body ??= {};
    void fn(req as PersonalRequest, res).catch(next);
  };

export function registerPersonalApi(app: Express, auth: RequestHandler): void {
  app.get(
    "/notifications/preferences",
    auth,
    route(async (req, res) => {
      const prefs = await update((db) =>
        preference(db, req.auth.sub, req.auth.kind),
      );
      res.json({ preferences: { ...prefs, ...pushConfig() } });
    }),
  );
  app.patch(
    "/notifications/preferences",
    auth,
    route(async (req, res) => {
      const prefs = await update((db) => {
        const p = preference(db, req.auth.sub, req.auth.kind);
        for (const key of [
          "push_enabled",
          "updates_enabled",
          "available_rides_enabled",
        ] as const)
          if (typeof req.body[key] === "boolean") p[key] = req.body[key];
        if (req.body.prompt === "later") {
          p.prompt_after = new Date(Date.now() + 7 * 86400000).toISOString();
          p.prompt_snoozed_until = p.prompt_after;
        }
        if (req.body.prompt === "declined") {
          p.prompt_dismissed = true;
          p.push_enabled = false;
        }
        if (req.body.prompt === "accepted") p.prompt_dismissed = true;
        if (["later", "declined", "accepted"].includes(req.body.prompt))
          p.first_ride_prompt_pending = false;
        return p;
      });
      res.json({ preferences: { ...prefs, ...pushConfig() } });
    }),
  );
  app.post(
    "/notifications/subscriptions",
    auth,
    route(async (req, res) => {
      if (!pushConfig().configured) {
        res
          .status(503)
          .json({
            message:
              "Browser notifications are not configured yet. Your inbox still works.",
          });
        return;
      }
      const { endpoint, keys } = req.body;
      let url: URL;
      try {
        url = new URL(endpoint);
      } catch {
        res.status(400).json({ message: "Invalid push subscription." });
        return;
      }
      const hosts = [
        "fcm.googleapis.com",
        "updates.push.services.mozilla.com",
        "web.push.apple.com",
        "wns.windows.com",
        "notify.windows.com",
      ];
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        (url.port && url.port !== "443") ||
        !hosts.some(
          (h) => url.hostname === h || url.hostname.endsWith(`.${h}`),
        ) ||
        typeof keys?.p256dh !== "string" ||
        !/^[A-Za-z0-9_-]{87}=?$/.test(keys.p256dh) ||
        typeof keys?.auth !== "string" ||
        !/^[A-Za-z0-9_-]{22}={0,2}$/.test(keys.auth)
      ) {
        res
          .status(400)
          .json({ message: "Unsupported or invalid push subscription." });
        return;
      }
      await update((db) => {
        const existing = db.pushSubscriptions?.find(
          (s) => s.endpoint === endpoint,
        );
        const sameOwner =
          existing?.user_id === req.auth.sub && existing.kind === req.auth.kind;
        db.pushSubscriptions = (db.pushSubscriptions ?? []).filter(
          (s) => s.endpoint !== endpoint,
        );
        if (!sameOwner)
          db.pushDeliveries = (db.pushDeliveries ?? []).filter(
            (d) => d.endpoint !== endpoint,
          );
        db.pushSubscriptions.push({
          user_id: req.auth.sub,
          kind: req.auth.kind,
          endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
          created_at: sameOwner
            ? existing.created_at
            : new Date().toISOString(),
        });
        const p = preference(db, req.auth.sub, req.auth.kind);
        p.push_enabled = true;
        p.prompt_dismissed = true;
      });
      res.status(201).json({ message: "Browser notifications enabled." });
    }),
  );
  app.delete(
    "/notifications/subscriptions",
    auth,
    route(async (req, res) => {
      await update((db) => {
        const endpoints = new Set(
          (db.pushSubscriptions ?? [])
            .filter(
              (s) =>
                s.user_id === req.auth.sub &&
                s.kind === req.auth.kind &&
                (!req.body.endpoint || s.endpoint === req.body.endpoint),
            )
            .map((s) => s.endpoint),
        );
        db.pushSubscriptions = (db.pushSubscriptions ?? []).filter(
          (s) => !endpoints.has(s.endpoint),
        );
        db.pushDeliveries = (db.pushDeliveries ?? []).filter(
          (d) => !endpoints.has(d.endpoint),
        );
      });
      res.json({
        message: "This device will no longer receive notifications.",
      });
    }),
  );
  app.post(
    "/notifications/read-all",
    auth,
    route(async (req, res) => {
      await update((db) => {
        for (const n of db.notifications)
          if (
            n.recipient_user_id === req.auth.sub &&
            n.recipient === req.auth.kind
          )
            n.read_at = new Date().toISOString();
      });
      res.json({ message: "All notifications marked as read." });
    }),
  );
  app.post(
    "/internal/notifications/dispatch",
    route(async (req, res) => {
      const token = process.env.NOTIFICATION_WORKER_TOKEN;
      if (!token || req.header("authorization") !== `Bearer ${token}`) {
        res.status(401).json({ message: "Unauthorized." });
        return;
      }
      await flushPush();
      res.json({ message: "Delivery batch processed." });
    }),
  );

  for (const target of ["account", "organization"] as const)
    app.delete(
      `/settings/${target}`,
      auth,
      route(async (req, res) => {
        if (target === "organization" && req.auth.kind !== "staff") {
          res
            .status(403)
            .json({
              message: "Only organization staff can delete an organization.",
            });
          return;
        }
        const snapshot = readDb();
        const user =
          req.auth.kind === "driver"
            ? snapshot.drivers.find((d) => d.id === req.auth.sub)
            : snapshot.staff.find((s) => s.id === req.auth.sub && s.is_active);
        if (
          !user ||
          typeof req.body.password !== "string" ||
          !(await bcrypt.compare(req.body.password, user.password_hash))
        ) {
          res
            .status(403)
            .json({
              message: "Enter your current password to confirm deletion.",
            });
          return;
        }
        const outcome = await update((db) => {
          const current =
            req.auth.kind === "driver"
              ? db.drivers.find((d) => d.id === req.auth.sub)
              : db.staff.find((s) => s.id === req.auth.sub && s.is_active);
          if (!current || current.password_hash !== user.password_hash)
            return {
              error: "Account access changed. Log in again.",
              status: 401,
            };
          const org = db.organizations.find(
            (o) => o.id === current.organization_id,
          );
          if (
            req.body.confirmation !==
              (target === "account" ? "DELETE" : "DELETE ORGANIZATION") ||
            (target === "organization" &&
              (!org ||
                req.body.organization_name !== org.name ||
                req.body.acknowledged !== true))
          )
            return {
              error: "Complete the deletion confirmation exactly as shown.",
              status: 400,
            };
          const affected = db.rides.filter((r) =>
            target === "organization"
              ? r.organization_id === org!.id
              : req.auth.kind === "driver" && r.driver_id === req.auth.sub,
          );
          if (affected.some((r) => r.status === "in_progress"))
            return {
              error: "Finish the ride in progress before deleting.",
              status: 409,
            };
          const users = new Set(
            target === "organization"
              ? db.staff
                  .filter((s) => s.organization_id === org!.id)
                  .map((s) => s.id)
              : [req.auth.sub],
          );
          const removedRides = new Set(
            target === "organization" ? affected.map((r) => r.id) : [],
          );
          const removedVerifications = db.verifications.filter((v) =>
            target === "organization"
              ? v.approved_by_org_id === org!.id
              : req.auth.kind === "driver" && v.driver_id === req.auth.sub,
          );
          if (target === "organization") {
            db.organizations = db.organizations.filter((o) => o.id !== org!.id);
            db.staff = db.staff.filter((s) => !users.has(s.id));
            db.clients = db.clients.filter(
              (c) => c.organization_id !== org!.id,
            );
            db.destinations = db.destinations.filter(
              (d) => d.organization_id !== org!.id,
            );
            db.rides = db.rides.filter((r) => !removedRides.has(r.id));
            for (const driver of db.drivers)
              if (driver.organization_id === org!.id)
                delete driver.organization_id;
          } else if (req.auth.kind === "driver") {
            db.drivers = db.drivers.filter((d) => d.id !== req.auth.sub);
            db.vehicles = db.vehicles.filter(
              (v) => v.driver_id !== req.auth.sub,
            );
            db.availabilities = db.availabilities.filter(
              (a) => a.driver_id !== req.auth.sub,
            );
            for (const ride of affected) {
              delete ride.driver_id;
              if (ride.status === "accepted") {
                ride.status = "requested";
                delete ride.waiting_minutes;
              }
              ride.updated_at = new Date().toISOString();
            }
          } else {
            db.staff = db.staff.filter((s) => s.id !== req.auth.sub);
            for (const ride of db.rides)
              if (ride.requested_by_user_id === req.auth.sub)
                ride.requested_by_user_id = "";
            for (const v of db.verifications)
              if (v.approved_by_user_id === req.auth.sub)
                delete v.approved_by_user_id;
          }
          const verificationIds = new Set(
            removedVerifications.map((v) => v.id),
          );
          db.verifications = db.verifications.filter(
            (v) => !verificationIds.has(v.id),
          );
          db.notifications = db.notifications.filter(
            (n) =>
              !users.has(n.recipient_user_id) &&
              !removedRides.has(n.ride_request_id),
          );
          db.notificationPreferences = (
            db.notificationPreferences ?? []
          ).filter((p) => !users.has(p.user_id));
          const removedEndpoints = new Set(
            (db.pushSubscriptions ?? [])
              .filter((s) => users.has(s.user_id))
              .map((s) => s.endpoint),
          );
          db.pushSubscriptions = (db.pushSubscriptions ?? []).filter(
            (s) => !removedEndpoints.has(s.endpoint),
          );
          const remainingNotes = new Set(db.notifications.map((n) => n.id));
          db.pushDeliveries = (db.pushDeliveries ?? []).filter(
            (d) =>
              !removedEndpoints.has(d.endpoint) &&
              remainingNotes.has(d.notification_id),
          );
          return {
            files: removedVerifications
              .map((v) => v.document_ref)
              .filter((f): f is string => !!f),
          };
        });
        if ("error" in outcome) {
          res.status(outcome.status ?? 400).json({ message: outcome.error });
          return;
        }
        for (const file of outcome.files)
          if (path.basename(file) === file) {
            try {
              fs.unlinkSync(path.join(uploadsDir(), file));
            } catch (e) {
              if ((e as NodeJS.ErrnoException).code !== "ENOENT")
                console.error("Deleted account document cleanup failed");
            }
          }
        res.json({
          message:
            target === "account"
              ? "Your account has been deleted."
              : "Your organization and its data have been deleted.",
        });
      }),
    );
}

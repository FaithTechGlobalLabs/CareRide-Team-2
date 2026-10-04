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
import { registerSqlNotificationApi } from "../notifications/sqlApi.js";

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
  registerSqlNotificationApi(app, auth);

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
              !removedRides.has(n.ride_request_id ?? ""),
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

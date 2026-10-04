import type {
  Express,
  Request,
  Response,
  RequestHandler,
  NextFunction,
} from "express";
import { pool } from "../db/db.js";
import { sqlPreference, ensureNotificationSchema } from "./sqlStore.js";
import { flushPush, pushConfig } from "./push.js";

type AuthRequest = Request & {
  auth: { sub: string; kind: "staff" | "driver" };
};
const route =
  (fn: (req: AuthRequest, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    req.body ??= {};
    void fn(req as AuthRequest, res).catch(next);
  };

export function registerSqlNotificationApi(app: Express, auth: RequestHandler) {
  app.get(
    "/notifications/preferences",
    auth,
    route(async (req, res) => {
      res.json({
        preferences: {
          ...(await sqlPreference(req.auth.sub, req.auth.kind)),
          ...pushConfig(),
        },
      });
    }),
  );
  app.patch(
    "/notifications/preferences",
    auth,
    route(async (req, res) => {
      await sqlPreference(req.auth.sub, req.auth.kind);
      const fields: string[] = [];
      const values: unknown[] = [req.auth.sub, req.auth.kind];
      for (const key of [
        "push_enabled",
        "updates_enabled",
        "available_rides_enabled",
      ] as const) {
        if (key === "push_enabled" && req.body.prompt === "declined") continue;
        if (typeof req.body[key] === "boolean") {
          values.push(req.body[key]);
          fields.push(`${key} = $${values.length}`);
        }
      }
      if (req.body.prompt === "later")
        fields.push(
          "prompt_after = now() + interval '7 days'",
          "prompt_snoozed_until = now() + interval '7 days'",
          "first_ride_prompt_pending = false",
        );
      if (req.body.prompt === "declined")
        fields.push(
          "prompt_dismissed = true",
          "push_enabled = false",
          "first_ride_prompt_pending = false",
        );
      if (req.body.prompt === "accepted")
        fields.push(
          "prompt_dismissed = true",
          "first_ride_prompt_pending = false",
        );
      if (fields.length)
        await pool.query(
          `UPDATE notification_preferences SET ${fields.join(", ")} WHERE user_id = $1 AND kind = $2`,
          values,
        );
      res.json({
        preferences: {
          ...(await sqlPreference(req.auth.sub, req.auth.kind)),
          ...pushConfig(),
        },
      });
    }),
  );
  app.post(
    "/notifications/read-all",
    auth,
    route(async (req, res) => {
      const column = req.auth.kind === "driver" ? "driver_id" : "staff_id";
      await pool.query(
        `UPDATE notifications SET is_read = true WHERE ${column} = $1`,
        [req.auth.sub],
      );
      res.json({ message: "All notifications marked as read." });
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
      await sqlPreference(req.auth.sub, req.auth.kind);
      await pool.query(
        `INSERT INTO push_subscriptions (endpoint, user_id, kind, p256dh, auth)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, kind = EXCLUDED.kind, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
        created_at = CASE WHEN push_subscriptions.user_id = EXCLUDED.user_id AND push_subscriptions.kind = EXCLUDED.kind THEN push_subscriptions.created_at ELSE now() END`,
        [endpoint, req.auth.sub, req.auth.kind, keys.p256dh, keys.auth],
      );
      await pool.query(
        `UPDATE notification_preferences SET push_enabled = true, prompt_dismissed = true, first_ride_prompt_pending = false WHERE user_id = $1 AND kind = $2`,
        [req.auth.sub, req.auth.kind],
      );
      res.status(201).json({ message: "Browser notifications enabled." });
    }),
  );
  app.delete(
    "/notifications/subscriptions",
    auth,
    route(async (req, res) => {
      await ensureNotificationSchema();
      await pool.query(
        `DELETE FROM push_subscriptions WHERE user_id = $1 AND kind = $2 AND ($3::text IS NULL OR endpoint = $3)`,
        [req.auth.sub, req.auth.kind, req.body.endpoint ?? null],
      );
      res.json({
        message: "This device will no longer receive notifications.",
      });
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
}

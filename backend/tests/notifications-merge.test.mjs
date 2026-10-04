import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import jwt from "jsonwebtoken";

test("merged SQL API registers staff preferences, inbox, read-all and subscriptions without touching JSON", async () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "careride-merge-test-"),
  );
  process.env.CARERIDE_DATA_DIR = directory;
  process.env.JWT_SECRET = "merge-test-only";
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_SUBJECT;
  const { pool } = await import("../src/db/db.ts");
  const original = pool.query;
  const queries = [];
  const userId = "00000000-0000-4000-8000-000000000001";
  const noteId = "00000000-0000-4000-8000-000000000002";
  const preference = {
    user_id: userId,
    kind: "staff",
    push_enabled: false,
    updates_enabled: true,
    available_rides_enabled: true,
    prompt_dismissed: false,
    prompt_after: new Date(Date.now() + 86400000).toISOString(),
  };
  pool.query = async (sql, values = []) => {
    queries.push({ sql, values });
    if (sql.startsWith("SELECT * FROM notification_preferences"))
      return { rows: [{ ...preference }] };
    if (sql.startsWith("UPDATE notification_preferences")) {
      if (sql.includes("prompt_dismissed = true"))
        preference.prompt_dismissed = true;
      return { rows: [] };
    }
    if (sql.includes("SELECT id, staff_id"))
      return {
        rows: [
          {
            id: noteId,
            staff_id: userId,
            title: "Client arrived",
            message: "Ride completed",
            metadata: { type: "completed" },
            is_read: false,
            created_at: new Date("2026-10-04T12:00:00Z"),
          },
        ],
      };
    if (sql.includes("RETURNING id, is_read"))
      return { rows: [{ id: noteId, is_read: true }] };
    return { rows: [] };
  };
  let server;
  try {
    const { registerApi } = await import("../src/api/routes.ts");
    const app = express();
    app.use(express.json());
    registerApi(app);
    app.use((req, res) => res.status(404).json({ error: "Route not found" }));
    app.use((error, req, res, next) =>
      res.status(500).json({ message: String(error) }),
    );
    await new Promise((resolve, reject) => {
      server = app.listen(0, "127.0.0.1", (error) =>
        error ? reject(error) : resolve(),
      );
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const token = jwt.sign(
      {
        sub: userId,
        kind: "staff",
        role: "staff",
        organizationId: "00000000-0000-4000-8000-000000000003",
      },
      process.env.JWT_SECRET,
    );
    async function call(url, method = "GET", body, authenticated = true) {
      const response = await fetch(origin + url, {
        method,
        headers: {
          ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    }
    assert.equal(
      (await call("/notifications/preferences", "GET", undefined, false))
        .status,
      401,
    );
    const prefs = await call("/notifications/preferences");
    assert.equal(prefs.status, 200);
    assert.equal(prefs.body.preferences.configured, false);
    assert.equal(
      (
        await call("/notifications/preferences", "PATCH", {
          prompt: "declined",
        })
      ).body.preferences.prompt_dismissed,
      true,
    );
    const inbox = await call("/notifications");
    assert.equal(inbox.status, 200);
    assert.equal(
      inbox.body.notifications[0].sent_at,
      "2026-10-04T12:00:00.000Z",
    );
    assert.equal(inbox.body.notifications[0].type, "completed");
    assert.equal(
      (await call(`/notifications/${noteId}/read`, "POST", {})).status,
      200,
    );
    assert.equal(
      (await call("/notifications/read-all", "POST", {})).status,
      200,
    );
    assert.equal(
      (await call("/notifications/subscriptions", "DELETE", {})).status,
      200,
    );
    assert.equal(
      (await call("/notifications/subscriptions", "POST", {})).status,
      503,
    );
    assert.ok(
      queries.some(
        (q) => q.sql.includes("WHERE staff_id = $1") && q.values[0] === userId,
      ),
    );
    assert.ok(
      queries.some((q) =>
        q.sql.includes("CREATE TABLE IF NOT EXISTS notification_preferences"),
      ),
    );
    assert.equal(fs.existsSync(path.join(directory, "store.json")), false);
  } finally {
    pool.query = original;
    if (server) await new Promise((resolve) => server.close(resolve));
    await pool.end();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

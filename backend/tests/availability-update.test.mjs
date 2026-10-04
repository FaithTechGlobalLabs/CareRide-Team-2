import assert from "node:assert/strict";
import test from "node:test";
import { registerApi } from "../dist/api/routes.js";
import { pool } from "../dist/db/db.js";

// Exercise the registered edit handler without network access or a live database.
const routes = new Map();
const app = Object.fromEntries(["get", "post", "patch", "delete"].map((method) =>
  [method, (path, ...handlers) => routes.set(`${method} ${path}`, handlers)]));
app.use = () => {};
registerApi(app);
const handler = routes.get("patch /drivers/me/availability/:id").at(-1);
const body = {
  kind: "weekly", start_time: "08:00", end_time: "18:00",
  centre_lat: 49.28, centre_lng: -123.12, radius_km: 25,
  weekdays: [1, 3], is_active: true, note: "Updated service area",
};

test("availability editing saves schedule fields and preserves pause/resume", async (t) => {
  const originalQuery = pool.query;
  const calls = [];
  let rows = [{ id: "rule", is_active: true }];
  pool.query = async (sql, values) => { calls.push({ sql, values }); return { rows }; };
  const invoke = (input) => new Promise((resolve, reject) => {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; },
      json(value) { resolve({ status: this.statusCode, body: value }); } };
    handler({ params: { id: "rule" }, auth: { sub: "driver" }, body: input }, response, reject);
  });
  try {
    await t.test("full edit saves coordinates, radius, hours, weekdays, and note for the authenticated driver", async () => {
      assert.equal((await invoke(body)).status, 200);
      const { sql, values } = calls.at(-1);
      assert.match(sql, /WHERE id = \$1 AND driver_id = \$2/);
      assert.match(sql, /ST_MakePoint/);
      assert.deepEqual(values, ["rule", "driver", -123.12, 49.28, 25000, "weekly", "08:00", "18:00", "", [1, 3], null, "Updated service area", true]);
    });
    await t.test("changing schedule kind clears fields from the old schedule", async () => {
      assert.equal((await invoke({ ...body, kind: "one_time", on_date: "2026-10-12" })).status, 200);
      assert.deepEqual(calls.at(-1).values.slice(8, 11), ["2026-10-12", null, null]);
      assert.equal((await invoke({ ...body, kind: "monthly", month_days: [5, 20] })).status, 200);
      assert.deepEqual(calls.at(-1).values.slice(8, 11), ["", null, [5, 20]]);
    });
    await t.test("pause/resume leaves schedule unchanged; omitted active state is preserved on full edits", async () => {
      assert.equal((await invoke({ is_active: false })).status, 200);
      assert.deepEqual(calls.at(-1).values, ["rule", "driver", false]);
      assert.doesNotMatch(calls.at(-1).sql, /SET centre/);
      const { is_active, ...withoutActive } = body;
      assert.equal((await invoke(withoutActive)).status, 200);
      assert.equal(calls.at(-1).values.at(-1), null);
      assert.match(calls.at(-1).sql, /COALESCE/);
    });
    await t.test("invalid edits fail before changing stored availability", async () => {
      const count = calls.length;
      for (const input of [
        {}, { is_active: "false" }, { ...body, end_time: "07:00" },
        { ...body, start_time: "25:00" }, { ...body, radius_km: 0 },
        { ...body, centre_lat: 100 }, { ...body, weekdays: [7] },
        { ...body, kind: "monthly", month_days: [] },
        { ...body, kind: "one_time", on_date: "2026-02-30" },
      ]) assert.equal((await invoke(input)).status, 400);
      assert.equal(calls.length, count);
    });
    await t.test("a missing rule or another driver's rule is not updated", async () => {
      rows = [];
      assert.equal((await invoke(body)).status, 404);
      assert.equal((await invoke({ is_active: false })).status, 404);
    });
  } finally {
    pool.query = originalQuery;
    await pool.end();
  }
});

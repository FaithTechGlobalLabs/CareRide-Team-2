import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "accepted-rides-test-only";
const { pool } = await import("../src/db/db.ts");
const { registerApi } = await import("../src/api/routes.ts");

test("SQL acceptance remains visible after reload to its driver and staff, and can be picked up", async () => {
  const ride = {
    id: "ride",
    organization_id: "org",
    requested_by_staff_id: "staff",
    status: "requested",
    driver_id: null,
    approved_at: null,
    requested_pickup_at: new Date(Date.now() + 86400000),
    first_name: "Test",
    last_name: "Rider",
    pickup_name: "Home",
    destination_name: "Clinic",
    passenger_count: 1,
    accessibility_needs: [],
  };
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const query = async (sql, values = []) => {
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [] };
    if (sql.includes("FOR UPDATE")) return { rows: [{ ...ride }] };
    if (sql.includes("SET status = 'approved'")) {
      assert.equal(values[0], ride.id);
      ride.status = "approved";
      ride.driver_id = values[1];
      ride.approved_at = new Date();
      return { rows: [{ id: ride.id }] };
    }
    if (sql.includes("SET status = 'in_progress'")) {
      assert.equal(values[1], ride.driver_id);
      assert.equal(values[2], ride.status);
      ride.status = "in_progress";
      ride.is_client_picked_up = true;
      return { rows: [{ id: ride.id }] };
    }
    if (sql.includes("UPDATE ride_requests") || sql.includes("INSERT INTO"))
      return { rows: [] };
    if (sql.includes("FROM ride_requests r")) {
      if (sql.includes("WHERE r.driver_id = $1"))
        return { rows: ride.driver_id === values[0] ? [{ ...ride }] : [] };
      if (sql.includes("WHERE r.organization_id = $1"))
        return {
          rows: ride.organization_id === values[0] && (!values[1] || ride.status === values[1])
            ? [{ ...ride }] : [],
        };
      if (sql.includes("r.status = 'requested'"))
        return { rows: ride.status === "requested" ? [{ ...ride }] : [] };
      if (sql.includes("WHERE r.id = $1"))
        return { rows: values[0] === ride.id ? [{ ...ride }] : [] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  let server;
  try {
    const app = express();
    app.use(express.json());
    registerApi(app);
    app.use((error, req, res, next) => res.status(500).json({ message: String(error) }));
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    async function call(path, method = "GET", kind = "driver", id = kind) {
      const token = jwt.sign({ sub: id, kind, role: kind, organizationId: "org" }, process.env.JWT_SECRET);
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      assert.equal(response.status, 200);
      return response.json();
    }
    assert.equal((await call("/drivers/me/rides/available")).rides.length, 1);
    const accepted = (await call("/rides/ride/accept", "POST")).ride;
    assert.equal(ride.status, "approved", "Preserve the database lifecycle status");
    assert.equal(accepted.status, "accepted");
    assert.equal(accepted.accepted_at, ride.approved_at.toISOString());
    assert.equal((await call("/drivers/me/rides/available")).rides.length, 0);

    // Reload through the same endpoint as the non-demo dashboard.
    const assigned = (await call("/drivers/me/rides")).rides;
    assert.deepEqual(assigned.filter(r => ["accepted", "in_progress"].includes(r.status)).map(r => r.id), [ride.id]);
    assert.equal(assigned[0].accepted_at, accepted.accepted_at);
    assert.deepEqual((await call("/drivers/me/rides", "GET", "driver", "other-driver")).rides, []);
    assert.equal((await call("/rides/ride")).ride.status, "accepted");
    assert.equal((await call("/rides", "GET", "staff")).rides[0].status, "accepted");
    assert.equal((await call("/rides?status=accepted", "GET", "staff")).rides[0].id, ride.id);
    assert.equal((await call("/rides/ride/pickup", "POST")).ride.status, "in_progress");
    assert.equal((await call("/drivers/me/rides")).rides[0].status, "in_progress");
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
    if (server) await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});

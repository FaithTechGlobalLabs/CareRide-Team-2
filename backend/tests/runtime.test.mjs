import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import test from "node:test";

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

for (const socketMode of [false, true]) {
test(socketMode
  ? "Cloud Run starts with only DB_* socket settings and no accessible database"
  : "server stays live during DB timeouts and shuts down cleanly on SIGTERM",
{ timeout: 10000 }, async () => {
  // Accept TCP connections but never answer PostgreSQL's startup handshake.
  const sockets = new Set();
  const database = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  const databasePort = await listen(database);
  const reservation = net.createServer();
  const httpPort = await listen(reservation);
  await new Promise((resolve) => reservation.close(resolve));

  const child = spawn(process.execPath, ["dist/index.js"], {
    cwd: new URL("../", import.meta.url),
    env: {
      ...process.env,
      PORT: String(httpPort),
      K_SERVICE: "test-backend",
      INSTANCE_CONNECTION_NAME: "",
      DATABASE_URL: "",
      POSTGRES_URL: "",
      POSTGRES_HOST: socketMode ? "" : "127.0.0.1",
      POSTGRES_PORT: socketMode ? "" : String(databasePort),
      POSTGRES_USER: socketMode ? "" : "test-user",
      POSTGRES_PASSWORD: socketMode ? "" : "test-password",
      POSTGRES_DB: socketMode ? "" : "test-database",
      DB_HOST: socketMode ? "/cloudsql/test-project:us-central1:missing-instance" : "",
      DB_USER: socketMode ? "test-user" : "",
      DB_PASS: socketMode ? "test-password" : "",
      DB_NAME: socketMode ? "test-database" : "",
      DB_PORT: "",
      DB_CONNECT_TIMEOUT_MS: "150",
      DB_POOL_MAX: "1",
      JWT_SECRET: "runtime-test-secret",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const exited = once(child, "exit");

  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Server did not start: ${output}`)), 4000);
      child.stdout.on("data", () => {
        if (output.includes("Server listening on port")) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    const url = `http://127.0.0.1:${httpPort}`;
    const live = await fetch(`${url}/health/live`, { signal: AbortSignal.timeout(2000) });
    assert.equal(live.status, 200);
    assert.deepEqual(await live.json(), { status: "ok" });
    const started = Date.now();
    const readiness = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
    assert.equal(readiness.status, 503);
    assert.deepEqual(await readiness.json(), { status: "degraded", database: "unavailable" });
    assert.ok(Date.now() - started < 2000, "Database handshake must time out");
    const root = await fetch(url, { signal: AbortSignal.timeout(2000) });
    assert.equal(root.status, 200);
    await root.json();
    child.kill("SIGTERM");
    const [code, signal] = await exited;
    assert.equal(signal, null);
    assert.equal(code, 0, output);
    assert.match(output, /draining requests and database connections/);
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => database.close(resolve));
  }
});
}

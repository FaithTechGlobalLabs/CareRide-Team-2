import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { databaseConfig } from "../dist/db/config.js";

const credentials = {
  POSTGRES_USER: "test-user",
  POSTGRES_PASSWORD: "test-password",
  POSTGRES_DB: "test-database",
};

test("Cloud Run deployment DB_* variables select the intended socket and credentials", async () => {
  const pool = new Pool(databaseConfig({
    K_SERVICE: "test-backend",
    DB_USER: "test-user",
    DB_PASS: "test-password",
    DB_NAME: "test-database",
    DB_HOST: "/cloudsql/test-project:us-central1:test-instance",
    DATABASE_URL: "postgres://localhost/wrong-database",
  }));
  try {
    const client = new pool.Client(pool.options);
    assert.equal(client.host, "/cloudsql/test-project:us-central1:test-instance");
    assert.equal(client.user, "test-user");
    assert.equal(client.password, "test-password");
    assert.equal(client.database, "test-database");
    assert.equal(client.ssl, false);
  } finally {
    await pool.end();
  }
});

test("DB_* names also support TCP and INSTANCE_CONNECTION_NAME", () => {
  const env = { DB_USER: "test-user", DB_PASS: "test-password", DB_NAME: "test-database" };
  const tcp = databaseConfig({ ...env, DB_HOST: "127.0.0.1", DB_PORT: "5433" });
  assert.equal(tcp.host, "127.0.0.1");
  assert.equal(tcp.port, 5433);
  const socket = databaseConfig({ ...env, INSTANCE_CONNECTION_NAME: "project:region:instance" });
  assert.equal(socket.host, "/cloudsql/project:region:instance");
  assert.equal(socket.database, "test-database");
});

test("POSTGRES_* settings retain precedence when both naming conventions are present", () => {
  const config = databaseConfig({
    ...credentials,
    POSTGRES_HOST: "127.0.0.1",
    DB_HOST: "other-host",
    DB_USER: "other-user",
    DB_PASS: "other-password",
    DB_NAME: "other-database",
  });
  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.user, credentials.POSTGRES_USER);
  assert.equal(config.password, credentials.POSTGRES_PASSWORD);
  assert.equal(config.database, credentials.POSTGRES_DB);
});

test("Cloud SQL selects a usable pg socket even with a stale local URL", async () => {
  const pool = new Pool(databaseConfig({
    ...credentials,
    INSTANCE_CONNECTION_NAME: "test-project:us-central1:test-instance",
    DATABASE_URL: "postgres://local-user:local-password@localhost:5432/local-database",
    POSTGRES_PORT: "5433",
  }));
  try {
    const client = new pool.Client(pool.options);
    assert.equal(client.host, "/cloudsql/test-project:us-central1:test-instance");
    assert.equal(client.port, 5432);
    assert.equal(client.user, credentials.POSTGRES_USER);
    assert.equal(client.database, credentials.POSTGRES_DB);
    assert.equal(client.ssl, false);
    assert.equal(pool.options.max, 5);
    assert.equal(pool.options.connectionTimeoutMillis, 5000);
  } finally {
    await pool.end();
  }
});

test("an explicit Cloud SQL host also overrides URL configuration", () => {
  const config = databaseConfig({
    ...credentials,
    POSTGRES_HOST: "/cloudsql/test-project:us-central1:test-instance",
    POSTGRES_URL: "postgres://localhost/wrong-database",
  });
  assert.equal(config.host, "/cloudsql/test-project:us-central1:test-instance");
  assert.equal(config.connectionString, undefined);
});

test("missing socket credentials fail early without revealing secrets", () => {
  assert.throws(() => databaseConfig({
    INSTANCE_CONNECTION_NAME: "test-project:us-central1:test-instance",
    POSTGRES_PASSWORD: "sensitive-test-value",
  }), (error) => {
    assert.match(error.message, /POSTGRES_USER/);
    assert.match(error.message, /POSTGRES_DB/);
    assert.ok(!error.message.includes("sensitive-test-value"));
    return true;
  });
});

test("malformed names and unusably long Unix socket paths fail early", () => {
  for (const name of ["instance-only", "project:region:../instance", "project:region:instance extra"]) {
    assert.throws(() => databaseConfig({ ...credentials, INSTANCE_CONNECTION_NAME: name }), /format/);
  }
  assert.throws(() => databaseConfig({
    ...credentials,
    INSTANCE_CONNECTION_NAME: `project:region:${"i".repeat(100)}`,
  }), /socket limit/);
});

test("hosted URL TLS options and local TCP configuration remain supported", () => {
  const url = "postgres://test-user:test-password@example.test/db?sslmode=require";
  const config = databaseConfig({ DATABASE_URL: url });
  assert.equal(config.connectionString, url);
  assert.equal(config.ssl, undefined);
  assert.equal(databaseConfig({ POSTGRES_URL: url }).connectionString, url);
  const tcp = databaseConfig({ ...credentials, POSTGRES_HOST: "127.0.0.1", POSTGRES_PORT: "5433" });
  assert.equal(tcp.host, "127.0.0.1");
  assert.equal(tcp.port, 5433);
});

test("pool settings can be tuned but not silently disabled by invalid values", () => {
  const config = databaseConfig({ DB_POOL_MAX: "3", DB_CONNECT_TIMEOUT_MS: "1000" });
  assert.equal(config.max, 3);
  assert.equal(config.connectionTimeoutMillis, 1000);
  for (const value of ["0", "-1", "1.5", "bad", "Infinity"]) {
    assert.throws(() => databaseConfig({ DB_POOL_MAX: value }), /DB_POOL_MAX/);
    assert.throws(() => databaseConfig({ DB_CONNECT_TIMEOUT_MS: value }), /DB_CONNECT_TIMEOUT_MS/);
    assert.throws(() => databaseConfig({ POSTGRES_PORT: value }), /POSTGRES_PORT/);
  }
  assert.throws(() => databaseConfig({ POSTGRES_PORT: "65536" }), /65535/);
});

test("Cloud Run cannot silently fall back to localhost with no database configured", () => {
  assert.throws(() => databaseConfig({ K_SERVICE: "test-backend" }), /Configure/);
});

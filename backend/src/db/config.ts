import type { PoolConfig } from "pg";

function positiveInteger(value: string | undefined, fallback: number, name: string): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function databaseConfig(env: NodeJS.ProcessEnv): PoolConfig {
  const config: PoolConfig = {
    max: positiveInteger(env.DB_POOL_MAX, 5, "DB_POOL_MAX"),
    connectionTimeoutMillis: positiveInteger(env.DB_CONNECT_TIMEOUT_MS, 5000, "DB_CONNECT_TIMEOUT_MS"),
    idleTimeoutMillis: 30000,
    keepAlive: true,
  };

  // An explicit Cloud SQL socket takes priority over a leftover local DATABASE_URL.
  const instance = env.INSTANCE_CONNECTION_NAME;
  if (instance && !/^[^:/\s]+:[^:/\s]+:[^:/\s]+$/.test(instance)) {
    throw new Error("INSTANCE_CONNECTION_NAME must have the format project:region:instance");
  }
  const host = instance ? `/cloudsql/${instance}` : env.POSTGRES_HOST || env.DB_HOST;
  const user = env.POSTGRES_USER || env.DB_USER;
  const password = env.POSTGRES_PASSWORD || env.DB_PASS;
  const database = env.POSTGRES_DB || env.DB_NAME;
  if (host?.startsWith("/cloudsql/")) {
    if (Buffer.byteLength(`${host}/.s.PGSQL.5432`) > 108) {
      throw new Error("Cloud SQL socket path exceeds the 108-byte Unix socket limit");
    }
    const missing = [
      !user && "POSTGRES_USER or DB_USER",
      !password && "POSTGRES_PASSWORD or DB_PASS",
      !database && "POSTGRES_DB or DB_NAME",
    ].filter(Boolean);
    if (missing.length) {
      throw new Error(`Cloud SQL connection requires: ${missing.join(", ")}`);
    }
    return {
      ...config,
      host,
      port: 5432,
      user,
      password,
      database,
      // Cloud Run's built-in Cloud SQL Auth Proxy encrypts the remote connection.
      ssl: false,
    };
  }

  const connectionString = env.DATABASE_URL || env.POSTGRES_URL;
  if (connectionString) return { ...config, connectionString };
  if (env.K_SERVICE && !host) {
    throw new Error("Configure INSTANCE_CONNECTION_NAME, DATABASE_URL, POSTGRES_HOST, or DB_HOST on Cloud Run");
  }
  const port = positiveInteger(env.POSTGRES_PORT || env.DB_PORT, 5432, "POSTGRES_PORT / DB_PORT");
  if (port > 65535) throw new Error("POSTGRES_PORT must be at most 65535");
  return {
    ...config,
    host,
    port,
    user,
    password,
    database,
  };
}

import "dotenv/config";
import express from "express";
import cors from "cors";
import { registerApi } from "./api/routes.js";
import { pool } from "./db/db.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
registerApi(app);

app.get("/", (_req, res) => {
  res.status(200).json({
    message: "CareRide backend is running",
  });
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok", database: "ok" });
  } catch {
    res.status(503).json({ status: "degraded", database: "unavailable" });
  }
});

app.get("/health/live", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use((_req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Request failed", { name: error instanceof Error ? error.name : "Error" });
  if (!res.headersSent) res.status(500).json({ message: "Something went wrong. Please try again." });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});

let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; draining requests and database connections`);

  // Cloud Run allows ten seconds after SIGTERM before killing the container.
  const deadline = setTimeout(() => {
    console.error("Shutdown deadline exceeded");
    process.exit(1);
  }, 9000);
  deadline.unref();

  server.close(async () => {
    try {
      await pool.end();
      clearTimeout(deadline);
      process.exit(0);
    } catch {
      console.error("Failed to close database connections during shutdown");
      process.exit(1);
    }
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

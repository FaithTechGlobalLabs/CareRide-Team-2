import "dotenv/config";
import express from "express";
import cors from "cors";
import { registerApi } from "./api/routes.js";

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

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

app.get("/health/live", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use((_req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
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

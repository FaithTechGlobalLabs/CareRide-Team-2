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

app.use((_req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

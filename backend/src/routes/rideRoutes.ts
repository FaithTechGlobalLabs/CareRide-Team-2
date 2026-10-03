// rideRoutes.ts

import express from "express";
import {
  createRide,
  getRides,
  getRideById,
  updateRide,
  deleteRide,
} from "../controllers/rideController.js";

const router = express.Router();

router.post("/", createRide);
router.get("/", getRides);
router.get("/:rideId", getRideById);
router.patch("/:rideId", updateRide);
router.delete("/:rideId", deleteRide);

export default router;
import express from "express";
import {
  registerOrganization
} from "../controllers/organizationController.js";

const router = express.Router();


//should create the superAdmin account so other admins can be registered
router.post("/register", registerOrganization);

export default router;
import express from "express";

import { registerAdmin, loginAdmin} from "../controllers/adminController.js";

const router = express.Router();

router.post("/admins/register", registerAdmin);
router.post("/admins/login", loginAdmin);

export default router;

import { type Request, type Response } from "express";
import type { StaffRole } from "../types/user.types.js";

import {
  getAllStaff,
  findStaffById,
  updateStaffRoleById,
  deleteStaffById,
} from "../db/staffHelpers.js";

export const listUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const staff = await getAllStaff();

    res.status(200).json({
      staff,
    });
  } catch (error) {
    console.error("List staff error:", error);

    res.status(500).json({
      message: "Internal server error.",
    });
  }
};

export const updateUserRole = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role) {
      res.status(400).json({
        message: "Role is required.",
      });
      return;
    }

    const validRoles: StaffRole[] = [
      "staff",
      "admin",
      "dispatcher",
      "driver",
    ];

    if (!validRoles.includes(role)) {
      res.status(400).json({
        message: "Invalid staff role.",
      });
      return;
    }

    const staff = await findStaffById(userId);

    if (!staff) {
      res.status(404).json({
        message: "Staff member not found.",
      });
      return;
    }

    const updatedStaff = await updateStaffRoleById(
      userId,
      role
    );

    res.status(200).json({
      message: "Staff role updated successfully.",
      staff: updatedStaff,
    });
  } catch (error) {
    console.error("Update staff role error:", error);

    res.status(500).json({
      message: "Internal server error.",
    });
  }
};

export const deleteUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    const staff = await findStaffById(userId);

    if (!staff) {
      res.status(404).json({
        message: "Staff member not found.",
      });
      return;
    }

    await deleteStaffById(userId);

    res.status(200).json({
      message: "Staff member deleted successfully.",
    });
  } catch (error) {
    console.error("Delete staff error:", error);

    res.status(500).json({
      message: "Internal server error.",
    });
  }
};
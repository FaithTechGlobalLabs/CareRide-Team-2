import { type Request, type Response } from "express";
import bcrypt from "bcrypt";

import type { Organization } from "../types/organization.types.js";
import type { Staff } from "../types/user.types.js";

import {
  createOrganization,
  findOrganizationByEmail,
} from "../db/organizationHelpers.js";

import {
  createStaff,
  findStaffByEmail,
} from "../db/staffHelpers.js";

export const registerOrganization = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      type,
      email,
      phone,
      address,
      staffName,
      staffEmail,
      staffPhone,
      staffPassword,
    } = req.body;

    if (
      !name ||
      !type ||
      !email ||
      !phone ||
      !address ||
      !staffName ||
      !staffEmail ||
      !staffPhone ||
      !staffPassword
    ) {
      res.status(400).json({
        message: "All organization and staff fields are required.",
      });
      return;
    }

    if (!["partner_org", "transport_provider"].includes(type)) {
      res.status(400).json({
        message: "Invalid organization type.",
      });
      return;
    }

    const existingOrganization = await findOrganizationByEmail(email);

    if (existingOrganization) {
      res.status(409).json({
        message: "An organization with this email already exists.",
      });
      return;
    }

    const existingStaff = await findStaffByEmail(staffEmail);

    if (existingStaff) {
      res.status(409).json({
        message: "A staff member with this email already exists.",
      });
      return;
    }

    const organizationData: Omit<
      Organization,
      "id" | "created_at"
    > = {
      name,
      type,
      contact_name: staffName,
      email,
      phone,
      address,
      status: "active",
    };

    const organization = await createOrganization(organizationData);

    const passwordHash = await bcrypt.hash(staffPassword, 10);

    const staffData: Omit<Staff, "id"> = {
      organization_id: organization.id,
      name: staffName,
      email: staffEmail,
      phone: staffPhone,
      password_hash: passwordHash,
      role: "admin",
      is_active: true,
    };

    const staff = await createStaff(staffData);

    res.status(201).json({
      message: "Organization registered successfully.",
      organization: {
        id: organization.id,
        name: organization.name,
        type: organization.type,
        email: organization.email,
        phone: organization.phone,
        address: organization.address,
        status: organization.status,
      },
      staff: {
        id: staff.id,
        organization_id: staff.organization_id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
      },
    });
  } catch (error) {
    console.error("Organization registration error:", error);

    res.status(500).json({
      message: "Internal server error.",
    });
  }
};
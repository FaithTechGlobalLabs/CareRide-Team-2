import { type Request, type Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// Replace this with your actual Organization model / DB client
import { Organization } from "../models/organization.model";

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
      password,
    } = req.body;

    // Validate required fields
    if (!name || !type || !email || !phone || !address || !password) {
      res.status(400).json({
        message:
          "Name, type, email, phone, address, and password are required.",
      });
      return;
    }

    // Check whether organization already exists
    const existingOrganization = await Organization.findOne({ email });

    if (existingOrganization) {
      res.status(409).json({
        message: "An organization with this email already exists.",
      });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create organization
    const organization = await Organization.create({
      name,
      type,
      email,
      phone,
      address,
      password: passwordHash,
    });

    res.status(201).json({
      message: "Organization registered successfully.",
      organization: {
        id: organization._id,
        name: organization.name,
        type: organization.type,
        email: organization.email,
        phone: organization.phone,
        address: organization.address,
      },
    });
  } catch (error) {
    console.error("Organization registration error:", error);

    res.status(500).json({
      message: "Internal server error.",
    });
  }
};

export const loginOrganization = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        message: "Email and password are required.",
      });
      return;
    }

    // Find organization
    const organization = await Organization.findOne({ email });

    if (!organization) {
      res.status(401).json({
        message: "Invalid email or password.",
      });
      return;
    }

    // Check password
    const passwordMatches = await bcrypt.compare(
      password,
      organization.password
    );

    if (!passwordMatches) {
      res.status(401).json({
        message: "Invalid email or password.",
      });
      return;
    }

    // Create JWT
    const token = jwt.sign(
      {
        organizationId: organization._id,
        type: organization.type,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "7d",
      }
    );

    res.status(200).json({
      message: "Login successful.",
      token,
      organization: {
        id: organization._id,
        name: organization.name,
        type: organization.type,
        email: organization.email,
        phone: organization.phone,
        address: organization.address,
      },
    });
  } catch (error) {
    console.error("Organization login error:", error);

    res.status(500).json({
      message: "Internal server error.",
    });
  }
};
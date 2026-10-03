import { pool } from "./db.js";
import type { Organization } from "../types/organization.types.js";

export const findOrganizationByEmail = async (
  email: string,
): Promise<Organization | null> => {
  const result = await pool.query<Organization>(
    `SELECT *
     FROM organizations
     WHERE email = $1`,
    [email],
  );

  return result.rows[0] ?? null;
};

export const createOrganization = async (
  organization: Omit<Organization, "id" | "created_at">,
): Promise<Organization> => {
  const result = await pool.query<Organization>(
    `INSERT INTO organizations
      (name, type, contact_name, email, phone, address, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      organization.name,
      organization.type,
      organization.contact_name,
      organization.email,
      organization.phone,
      organization.address,
      organization.status,
    ],
  );

  const created = result.rows[0];
  if (!created) {
    throw new Error("Insert did not return an organization row.");
  }
  return created;
};

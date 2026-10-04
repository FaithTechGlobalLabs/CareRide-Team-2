import { pool } from "./db.js";
import type { Organization } from "../types/organization.types.js";

export const findOrganizationByEmail = async (
  email: string,
): Promise<Organization | null> => {
  const result = await pool.query<Organization>(
    `SELECT id, name, email, phone, created_at
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
    `INSERT INTO organizations (name, email, phone)
     VALUES ($1, $2, $3)
     RETURNING id, name, email, phone, created_at`,
    [organization.name, organization.email, organization.phone],
  );

  const created = result.rows[0];
  if (!created) {
    throw new Error("Insert did not return an organization row.");
  }
  return created;
};

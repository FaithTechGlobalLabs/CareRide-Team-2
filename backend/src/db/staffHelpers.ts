import { pool } from "./db.js";
import type { Staff, StaffRole } from "../types/user.types.js";

function postgresUnused(): never {
  throw new Error(
    "Postgres staff helpers are unused. Use the JSON API in src/api/routes.ts.",
  );
}

export const findStaffByEmail = async (
  email: string,
): Promise<Staff | null> => {
  const result = await pool.query<Staff>(
    `SELECT *
     FROM staff
     WHERE email = $1`,
    [email],
  );

  return result.rows[0] ?? null;
};

export const createStaff = async (staff: Omit<Staff, "id">): Promise<Staff> => {
  const result = await pool.query<Staff>(
    `INSERT INTO staff
      (organization_id, name, email, phone, password_hash, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, organization_id, name, email, phone, password_hash, is_active`,
    [
      staff.organization_id,
      staff.name,
      staff.email,
      staff.phone,
      staff.password_hash,
      staff.is_active,
    ],
  );

  const created = result.rows[0];
  if (!created) {
    throw new Error("Insert did not return a staff row.");
  }
  return created;
};

export const getAllStaff = async (): Promise<Staff[]> => postgresUnused();

export const findStaffById = async (
  _id: string | string[] | undefined,
): Promise<Staff | null> => postgresUnused();

export const updateStaffRoleById = async (
  _id: string | string[] | undefined,
  _role: StaffRole,
): Promise<Staff> => postgresUnused();

export const deleteStaffById = async (
  _id: string | string[] | undefined,
): Promise<void> => postgresUnused();

import pool from "./db.js";
import type { Staff } from "../types/user.types.js";

export const findStaffByEmail = async (
  email: string
): Promise<Staff | null> => {
  const result = await pool.query<Staff>(
    `SELECT *
     FROM staff
     WHERE email = $1`,
    [email]
  );

  return result.rows[0] ?? null;
};

export const createStaff = async (
  staff: Omit<Staff, "id">
): Promise<Staff> => {
  const result = await pool.query<Staff>(
    `INSERT INTO staff
      (organization_id, name, email, phone, password_hash, role, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      staff.organization_id,
      staff.name,
      staff.email,
      staff.phone,
      staff.password_hash,
      staff.role,
      staff.is_active,
    ]
  );

  return result.rows[0];
};
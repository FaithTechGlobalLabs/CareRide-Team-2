import type { ApiPayload } from "@careride/api-contracts/http/api-responses";

import type { Session } from "./types";

import { demoRequest } from "./demo";

const configuredApiUrl: string | undefined = import.meta.env.VITE_API_URL;
export const API_URL = configuredApiUrl?.replace(/\/$/, "");
export const IS_DEMO = !API_URL;
export async function request<T>(
  path: string,
  session: Session | null,
  method = "GET",
  body?: unknown
): Promise<T> {
  if (IS_DEMO) {
    // The caller supplies the response contract; demo and HTTP share this boundary.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return (await demoRequest(path, method, body, session)) as T;
  }
  const multipart = body instanceof FormData;
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(!multipart && body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    ...(body === undefined
      ? {}
      : { body: multipart ? body : JSON.stringify(body) }),
  });
  const payload: ApiPayload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      payload.message ?? payload.error ?? `Request failed (${response.status}).`
    );
  const keys = Object.keys(payload);
  const result =
    payload.data ??
    (keys.length === 1 && !["message", "error"].includes(keys[0])
      ? payload[keys[0]]
      : payload);
  // The endpoint-specific response contract is supplied by the caller.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return normalize(result) as T;
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;
  const record: Record<string, unknown> = { ...value };
  if (typeof record.document_type === "string") {
    record.check_type ??= record.document_type;
    record.document_ref ??= record.document_filename;
    if (typeof record.organization_name === "string" && !record.organization) {
      record.organization = {
        id: record.approved_by_org_id,
        name: record.organization_name,
      };
    }
  }
  if (
    typeof record.token === "string" &&
    record.user &&
    typeof record.user === "object"
  ) {
    const user: Record<string, unknown> = { ...record.user };
    if (!user.role && user.kind === "driver") user.role = "driver";
    record.user = user;
  }
  if (typeof record.driver_name === "string") {
    record.driver = {
      id: record.driver_id,
      name: record.driver_name,
      email: record.driver_email ?? "",
      phone: record.driver_phone ?? "",
      vehicle: record.vehicle,
    };
  }
  return record;
}

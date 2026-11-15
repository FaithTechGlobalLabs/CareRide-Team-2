import { z } from "zod";

/** The API uses both named response fields and a data envelope. */
export const apiPayloadSchema = z.looseObject({
  message: z.string().optional(),
  error: z.string().optional(),
  data: z.unknown().optional(),
});

export type ApiPayload = z.infer<typeof apiPayloadSchema>;

import { z } from "zod";

/** The preferences value returned by the notification settings endpoints. */
export const notificationPreferencesResponseSchema = z.object({
  push_enabled: z.boolean(),
  updates_enabled: z.boolean(),
  available_rides_enabled: z.boolean(),
  prompt_after: z.string(),
  prompt_dismissed: z.boolean(),
  configured: z.boolean(),
  public_key: z.string().nullable(),
  first_ride_prompt_pending: z.boolean().optional(),
});

export type NotificationPreferencesResponse = z.infer<
  typeof notificationPreferencesResponseSchema
>;

import { z } from "zod"

/** JSON representation produced by the current ride response mapper. */
export const rideResponseSchema = z.object({
  id: z.uuid(),
  client_id: z.uuid(),
  requested_by_staff_id: z.uuid(),
  organization_id: z.uuid(),
  pickup_address: z.string(),
  pickup_lat: z.number(),
  pickup_lng: z.number(),
  destination_id: z.uuid(),
  destination_address: z.string(),
  destination_lat: z.number(),
  destination_lng: z.number(),
  requested_pickup_at: z.iso.datetime({ offset: true }),
  passenger_count: z.int().positive(),
  accessibility_needs: z.string(),
  accessibility_need_list: z.array(z.string()),
  notes: z.string().nullable(),
  // The mapper exposes database status "approved" as "accepted".
  status: z.enum([
    "requested",
    "accepted",
    "in_progress",
    "completed",
    "cancelled",
    "no_show",
    "timed_out",
  ]),
  driver_id: z.uuid().nullable(),
  approved_by_user_id: z.uuid().nullable(),
  approved_at: z.iso.datetime({ offset: true }).nullable(),
  accepted_at: z.iso.datetime({ offset: true }).nullable(),
  ride_option: z.enum(["free", "paid_external"]),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  completed_at: z.iso.datetime({ offset: true }).nullable(),
  cancelled_reason: z.string().nullable(),
  is_client_picked_up: z.boolean(),
  is_client_dropped_off: z.boolean(),
  trip_group_id: z.uuid().nullable(),
  linked_ride_id: z.uuid().nullable(),
  trip_leg: z.enum(["outbound", "return"]).nullable(),
  client_name: z.string(),
  driver_name: z.string().nullable(),
  driver_phone: z.string().nullable(),
  vehicle: z
    .object({
      make: z.string(),
      model: z.string(),
      plate: z.string(),
      seats: z.int().positive(),
    })
    .nullable(),
  sample: z.boolean(),
})

/** POST /rides 201 response, with the outbound leg before the optional return leg. */
export const createRideResponseSchema = z.object({
  rides: z.array(rideResponseSchema),
})

/** POST /rides 400, 401, 403, and 500 response body. */
export const createRideErrorResponseSchema = z.object({
  message: z.string(),
})

export type RideResponse = z.infer<typeof rideResponseSchema>
export type CreateRideResponse = z.infer<typeof createRideResponseSchema>
export type CreateRideErrorResponse = z.infer<
  typeof createRideErrorResponseSchema
>

import { z } from "zod"

const bookingFields = {
  client_id: z.uuid(),
  pickup_destination_id: z.uuid(),
  destination_id: z.uuid(),
  requested_pickup_at: z.iso.datetime({ offset: true }),
  passenger_count: z.int().positive(),
  accessibility_needs: z.union([z.string(), z.array(z.string())]).optional(),
  notes: z.string().optional(),
}

// Omitting trip_type requests a one-way booking in the current API.
const oneWayRideRequestSchema = z.object({
  ...bookingFields,
  trip_type: z.literal("one_way").optional(),
  return_pickup_at: z.iso.datetime({ offset: true }).optional(),
})

const roundTripRideRequestSchema = z.object({
  ...bookingFields,
  trip_type: z.literal("round_trip"),
  return_pickup_at: z.iso.datetime({ offset: true }),
})

/** POST /rides JSON body. Address snapshots come from the server's address book.
 * Unknown fields are stripped, including the redundant snapshots sent by the UI.
 */
export const createRideRequestSchema = z.discriminatedUnion("trip_type", [
  oneWayRideRequestSchema,
  roundTripRideRequestSchema,
])

export type CreateRideRequest = z.infer<typeof createRideRequestSchema>

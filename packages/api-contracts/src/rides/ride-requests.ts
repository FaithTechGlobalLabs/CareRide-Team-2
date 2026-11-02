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

/** POST /rides/:id/accept path parameters. The current handler does not validate UUIDs. */
export const acceptRideParamsSchema = z.object({
  id: z.string(),
})

/** POST /rides/:id/accept requires no body and ignores any supplied body.
 * The authenticated driver ID comes from the bearer token, not the body.
 */
export const acceptRideRequestSchema = z.unknown()

export type CreateRideRequest = z.infer<typeof createRideRequestSchema>
export type AcceptRideParams = z.infer<typeof acceptRideParamsSchema>
export type AcceptRideRequest = z.infer<typeof acceptRideRequestSchema>

import { z } from "zod";

/** Fields consumed from OSRM's driving-route response. */
export const drivingRouteResponseSchema = z.object({
  code: z.string().optional(),
  routes: z
    .array(z.object({ duration: z.number(), distance: z.number() }))
    .optional(),
});

/** Fields consumed from Nominatim's JSON search response. */
export const geocodingResponseSchema = z.array(
  z.object({ lat: z.string().optional(), lon: z.string().optional() })
);

export type DrivingRouteResponse = z.infer<typeof drivingRouteResponseSchema>;
export type GeocodingResponse = z.infer<typeof geocodingResponseSchema>;

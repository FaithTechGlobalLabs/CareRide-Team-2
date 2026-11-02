/**
 * The controller has one main job - go between HTTP, and my backend application.
 * It should:
 * - Validate and sanitize input,
 * - Call the appropriate service, which will provide an interface for actions coordinating operations on aggregates/entities,
 * - Format the response by delegating to a response mapper or serializer,,
 * - Handle errors related to HTTP.
 * It should not handle business logic, database access.
 */

import type {
  AcceptRideErrorResponse,
  AcceptRideResponse,
} from "@careride/api-contracts/rides/ride-responses"

import {
  acceptRideParamsSchema,
  acceptRideRequestSchema,
} from "@careride/api-contracts/rides/ride-requests"

import type { ITokenVerifier } from "../../application/ports/tokenVerifier.js"
import type { IRideRequestsService } from "../../application/services/rideRequests/rideRequestsService.js"

import { toRideResponse } from "../mappers/rideResponseMapper.js"

export interface AcceptRideHttpRequest {
  authorization?: string | undefined
  params: unknown
  body?: unknown
}

export type AcceptRideHttpResponse =
  | { status: 200; body: AcceptRideResponse }
  | { status: 401 | 403 | 404 | 409 | 500; body: AcceptRideErrorResponse }

export class RidesController {
  constructor(
    private readonly rideRequestsService: IRideRequestsService,
    private readonly tokenVerifier: ITokenVerifier
  ) {}

  async acceptRide(
    request: AcceptRideHttpRequest
  ): Promise<AcceptRideHttpResponse> {
    const authorization = request.authorization ?? ""
    const token = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : ""
    if (!token) return { status: 401, body: { message: "Login required." } }

    try {
      const actor = await this.tokenVerifier.verify(token)
      if (!actor) return { status: 401, body: { message: "Login expired." } }
      if (actor.kind !== "driver") {
        return {
          status: 403,
          body: { message: "This account cannot open that page." },
        }
      }
      const params = acceptRideParamsSchema.parse(request.params)
      acceptRideRequestSchema.parse(request.body) // Optional body is deliberately ignored.
      const result = await this.rideRequestsService.acceptRide({
        rideId: params.id,
        actor,
      })
      switch (result.kind) {
        case "accepted":
          return {
            status: 200,
            body: { ride: result.ride ? toRideResponse(result.ride) : null },
          }
        case "notFound":
          return { status: 404, body: { message: "Ride not found." } }
        case "alreadyAssigned":
          return { status: 409, body: { message: "Already assigned" } }
        case "timedOut":
          return { status: 409, body: { message: "This ride timed out." } }
        case "notEligible":
          return {
            status: 403,
            body: { message: "You are not eligible for this ride." },
          }
        case "forbidden":
          return {
            status: 403,
            body: { message: "This account cannot open that page." },
          }
      }
    } catch (error) {
      console.error("Accept ride failed", {
        name: error instanceof Error ? error.name : "Error",
      })
      return {
        status: 500,
        body: { message: "Something went wrong. Please try again." },
      }
    }
  }
}

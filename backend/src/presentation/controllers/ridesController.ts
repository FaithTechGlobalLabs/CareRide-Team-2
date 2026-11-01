/**
 * The controller has one main job - go between HTTP, and my backend application.
 * It should:
 * - Validate and sanitize input,
 * - Call the appropriate service, which will provide an interface for actions coordinating operations on aggregates/entities,
 * - Format the response by delegating to a response mapper or serializer,,
 * - Handle errors related to HTTP.
 * It should not handle business logic, database access.
 */

import type { Request, Response } from "express"

import type { IRideRequestsService } from "../../application/services/rideRequests/rideRequestsService.js"

export class RidesController {
  private readonly rideRequestsService: IRideRequestsService

  constructor(rideRequestsService: IRideRequestsService) {
    this.rideRequestsService = rideRequestsService
  }
  async acceptRide(req: Request, res: Response): Promise<void> {}
}

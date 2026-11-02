import type { IClock } from "../application/ports/clock.js"
import type { IDriverEligibilityQuery } from "../application/ports/driverEligibilityQuery.js"
import type { INotificationsRepository } from "../application/ports/notificationsRepository.js"
import type { IRideQueries } from "../application/ports/rideQueries.js"
import type { IRideRequestsRepository } from "../application/ports/rideRequestsRepository.js"
import type { ITokenVerifier } from "../application/ports/tokenVerifier.js"
import type { DatabaseClient } from "./persistence/databaseClient.js"

import {
  RideRequestsService,
  type IRideRequestsService,
} from "../application/services/rideRequests/rideRequestsService.js"
import { RideAcceptancePolicy } from "../domain/rides/rideAcceptancePolicy.js"
import { RidesController } from "../presentation/controllers/ridesController.js"
import { JwtTokenVerifier } from "./authentication/jwtTokenVerifier.js"
import { databaseClient } from "./persistence/databaseClient.js"
import { DriverEligibilityQuery } from "./persistence/queries/driverEligibilityQuery.js"
import { RideQueries } from "./persistence/queries/rideQueries.js"
import { NotificationsRepository } from "./persistence/repositories/notificationsRepository.js"
import { RideRequestsRepository } from "./persistence/repositories/rideRequestsRepository.js"
import { SystemClock } from "./systemClock.js"

export class Container {
  private readonly ridesController: RidesController
  private readonly rideRequestsService: IRideRequestsService

  constructor({
    ridesController,
    rideRequestsService,
    database = databaseClient,
    rideRequestsRepository,
    driverEligibilityQuery,
    notificationsRepository,
    rideQueries,
    clock,
    tokenVerifier,
  }: {
    ridesController?: RidesController
    rideRequestsService?: IRideRequestsService
    database?: DatabaseClient
    rideRequestsRepository?: IRideRequestsRepository
    driverEligibilityQuery?: IDriverEligibilityQuery
    notificationsRepository?: INotificationsRepository
    rideQueries?: IRideQueries
    clock?: IClock
    tokenVerifier?: ITokenVerifier
  } = {}) {
    this.rideRequestsService =
      rideRequestsService ??
      new RideRequestsService(
        database,
        rideRequestsRepository ?? new RideRequestsRepository(),
        driverEligibilityQuery ?? new DriverEligibilityQuery(),
        notificationsRepository ?? new NotificationsRepository(),
        rideQueries ?? new RideQueries(database),
        clock ?? new SystemClock(),
        new RideAcceptancePolicy()
      )
    this.ridesController =
      ridesController ??
      new RidesController(
        this.rideRequestsService,
        tokenVerifier ??
          new JwtTokenVerifier(process.env.JWT_SECRET || "careride-dev-secret")
      )
  }

  get ridesControllerInstance(): RidesController {
    return this.ridesController
  }
}

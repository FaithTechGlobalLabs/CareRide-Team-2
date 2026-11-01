import {
  RideRequestsService,
  type IRideRequestsService,
} from "../application/services/rideRequests/rideRequestsService.js"
import { RidesController } from "../presentation/controllers/ridesController.js"

export class Container {
  private readonly ridesController: RidesController
  private readonly rideRequestsService: IRideRequestsService

  constructor({
    ridesController,
    rideRequestsService,
  }: {
    ridesController?: RidesController
    rideRequestsService?: IRideRequestsService
  }) {
    this.rideRequestsService =
      rideRequestsService ??
      new RideRequestsService(/* pass in dependencies here */)
    this.ridesController =
      ridesController ?? new RidesController(this.rideRequestsService)
  }

  get ridesControllerInstance(): RidesController {
    return this.ridesController
  }
}

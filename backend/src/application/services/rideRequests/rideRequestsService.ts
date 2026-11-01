export interface IRideRequestsService {}

export class RideRequestsService implements IRideRequestsService {
  private readonly rideRequestsRepository: IRideRequestsRepository

  constructor(rideRequestsRepository: IRideRequestsRepository) {
    this.rideRequestsRepository = rideRequestsRepository
  }
}

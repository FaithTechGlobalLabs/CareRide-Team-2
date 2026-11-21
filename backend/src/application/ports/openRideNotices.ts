export interface IOpenRideNoticesRepository {
  /** Match all eligible drivers and bulk-create one notice per driver/booking. */
  createForBooking(rideIds: readonly string[]): Promise<string[]>;
}

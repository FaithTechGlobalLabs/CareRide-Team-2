import type {
  IPushDeliveriesRepository,
  IPushTransport,
  PushDelivery,
  PushDeliveryScope,
  PushOutcome,
} from "../../ports/pushDeliveries.js";

export interface PushDeliveryResult {
  attempted: number;
  sent: number;
  skipped: number;
  failed: number;
  configured: boolean;
}

export class PushDeliveryService {
  constructor(
    private readonly pushDeliveriesRepository: IPushDeliveriesRepository,
    private readonly pushTransport: IPushTransport
  ) {}

  async deliver(scope: PushDeliveryScope): Promise<PushDeliveryResult> {
    const result: PushDeliveryResult = {
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      configured: this.pushTransport.configured,
    };
    if (
      !result.configured ||
      (scope.kind === "notifications" && scope.notificationIds.length === 0)
    )
      return result;
    const deliveries =
      await this.pushDeliveriesRepository.enqueueAndListDueDeliveries(scope);
    for (let offset = 0; offset < deliveries.length; offset += 8) {
      // Claim immediately before sending, so a large fan-out cannot exhaust claims while waiting.
      const claimedDeliveries =
        await this.pushDeliveriesRepository.claimDueDeliveries(
          deliveries.slice(offset, offset + 8)
        );
      await Promise.all(
        claimedDeliveries.map(async (delivery) => {
          try {
            const outcome = await this.send(delivery);
            await this.pushDeliveriesRepository.record(delivery, outcome);
            if (outcome.kind === "skipped") result.skipped++;
            else {
              result.attempted++;
              if (outcome.kind === "sent") result.sent++;
              else {
                result.failed++;
                console.warn("Push provider declined delivery", {
                  kind: outcome.kind,
                  ...("status" in outcome ? { status: outcome.status } : {}),
                });
              }
            }
          } catch (error) {
            result.failed++;
            console.error("Push delivery failed", {
              name: error instanceof Error ? error.name : "Error",
            });
          }
        })
      );
    }
    return result;
  }

  private async send(delivery: PushDelivery): Promise<PushOutcome> {
    const target = await this.pushDeliveriesRepository.getTarget(delivery);
    if (!target) return { kind: "skipped" };
    const driverOffer =
      target.kind === "driver" && target.type === "available_ride";
    return this.pushTransport.send(target.subscription, {
      title: "CareRide",
      body:
        target.kind === "driver"
          ? driverOffer
            ? "A ride fits your availability. Tap to view available rides."
            : "A ride fits your availability. Open CareRide for details."
          : "There is an update for your organization. Open CareRide for details.",
      url: driverOffer ? "/driver" : "/notifications",
      tag: delivery.notificationId,
    });
  }
}

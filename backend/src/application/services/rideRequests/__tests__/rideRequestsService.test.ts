import { describe, expect, test, vi } from "vitest"

import type { RideAcceptancePolicy } from "../../../../domain/rides/rideAcceptancePolicy.js"
import type { IClock } from "../../../ports/clock.js"
import type {
  DatabaseTransaction,
  TransactionalDatabase,
} from "../../../ports/database.js"
import type { IDriverEligibilityQuery } from "../../../ports/driverEligibilityQuery.js"
import type { INotificationsRepository } from "../../../ports/notificationsRepository.js"
import type {
  IRideQueries,
  RideDetails,
  RideNotificationContext,
} from "../../../ports/rideQueries.js"
import type { IRideRequestsRepository } from "../../../ports/rideRequestsRepository.js"
import type { AuthenticatedActor } from "../../../ports/tokenVerifier.js"

import {
  AcceptedDispatch,
  RideRequest,
  type RideRequestState,
} from "../../../../domain/rides/rideRequest.js"
import { RideAssignmentConflict } from "../../../ports/rideRequestsRepository.js"
import { RideRequestsService } from "../rideRequestsService.js"

const now = new Date("2030-01-15T12:00:00Z")
const pickupAt = new Date("2030-01-16T18:00:00Z")
const rideId = "ride-1"
const driverId = "driver-1"
const actor: AuthenticatedActor = { id: driverId, kind: "driver" }
const input = { rideId, actor }

function createHarness(overrides: Partial<RideRequestState> = {}) {
  const ride = new RideRequest({
    id: rideId,
    status: "requested",
    driverId: null,
    requestedPickupAt: pickupAt,
    passengerCount: 2,
    accessibilityNeeds: ["Wheelchair"],
    acceptedDispatch: null,
    ...overrides,
  })
  // The service only forwards this handle; no database operations run in these tests.
  const transaction = {} as DatabaseTransaction
  const lifecycle = { committed: false }
  const execute = vi.fn(
    async <T>(run: (transaction: DatabaseTransaction) => Promise<T>) => {
      const result = await run(transaction)
      lifecycle.committed = true
      return result
    }
  )
  // Only execute is used; the double omits Kysely's private builder internals.
  const database = {
    transaction: vi.fn<TransactionalDatabase["transaction"]>().mockReturnValue({
      execute,
    } as unknown as ReturnType<TransactionalDatabase["transaction"]>),
  }
  const ridesRepository = {
    findForAcceptance: vi
      .fn<IRideRequestsRepository["findForAcceptance"]>()
      .mockResolvedValue(ride),
    saveTimeout: vi
      .fn<IRideRequestsRepository["saveTimeout"]>()
      .mockResolvedValue(undefined),
    saveAcceptance: vi
      .fn<IRideRequestsRepository["saveAcceptance"]>()
      .mockResolvedValue(true),
  }
  const facts = { verifications: [], vehicles: [], availabilities: [] }
  const eligibilityQuery = {
    getFacts: vi
      .fn<IDriverEligibilityQuery["getFacts"]>()
      .mockResolvedValue(facts),
  }
  const notificationsRepository = {
    addForStaff: vi
      .fn<INotificationsRepository["addForStaff"]>()
      .mockResolvedValue(undefined),
  }
  const context: RideNotificationContext = {
    requestedByStaffId: "staff-1",
    clientFirstName: "Jamie",
    pickupAt,
    passengerCount: 2,
    pickupName: "Home",
    destinationName: "Clinic",
    tripLeg: "return",
  }
  const details: RideDetails = {
    id: rideId,
    clientId: "client-1",
    requestedByStaffId: "staff-1",
    organizationId: "organization-1",
    pickupAddress: "123 Main St",
    pickupLatitude: 49.28,
    pickupLongitude: -123.12,
    destinationId: "destination-1",
    destinationAddress: "456 Clinic St",
    destinationLatitude: 49.27,
    destinationLongitude: -123.11,
    requestedPickupAt: pickupAt,
    passengerCount: 2,
    accessibilityNeeds: ["Wheelchair"],
    notes: null,
    status: "accepted",
    driverId,
    approvedByStaffId: null,
    acceptedAt: now,
    rideOption: "free",
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    cancelledReason: null,
    clientPickedUp: false,
    clientDroppedOff: false,
    tripGroupId: null,
    linkedRideId: null,
    tripLeg: "return",
    client: { firstName: "Jamie", lastName: "Rider" },
    driver: { firstName: "Alex", lastName: "Driver", phone: "555-0100" },
    vehicle: { make: "Test", model: "Van", plate: "TEST123", seats: 3 },
  }
  const rideQueries = {
    getDetails: vi.fn<IRideQueries["getDetails"]>().mockResolvedValue(details),
    getNotificationContext: vi
      .fn<IRideQueries["getNotificationContext"]>()
      .mockResolvedValue(context),
  }
  const clock = { now: vi.fn<IClock["now"]>().mockReturnValue(now) }
  const policy = {
    evaluate: vi
      .fn<RideAcceptancePolicy["evaluate"]>()
      .mockReturnValue("eligible"),
  }
  const service = new RideRequestsService(
    database,
    ridesRepository,
    eligibilityQuery,
    notificationsRepository,
    rideQueries,
    clock,
    policy
  )

  return {
    service,
    ride,
    transaction,
    lifecycle,
    database,
    execute,
    ridesRepository,
    eligibilityQuery,
    facts,
    notificationsRepository,
    rideQueries,
    details,
    clock,
    policy,
  }
}

describe("RideRequestsService.acceptRide", () => {
  test("forbids staff before starting a transaction", async () => {
    const h = createHarness()

    expect(
      await h.service.acceptRide({
        rideId,
        actor: { id: "staff-1", kind: "staff" },
      })
    ).toEqual({ kind: "forbidden" })
    expect(h.database.transaction).not.toHaveBeenCalled()
    expect(h.ridesRepository.findForAcceptance).not.toHaveBeenCalled()
    expect(h.rideQueries.getDetails).not.toHaveBeenCalled()
  })

  test("returns notFound without checking eligibility or writing", async () => {
    const h = createHarness()
    h.ridesRepository.findForAcceptance.mockResolvedValue(null)

    expect(await h.service.acceptRide(input)).toEqual({ kind: "notFound" })
    expect(h.ridesRepository.findForAcceptance).toHaveBeenCalledExactlyOnceWith(
      rideId,
      h.transaction
    )
    expect(h.clock.now).not.toHaveBeenCalled()
    expect(h.eligibilityQuery.getFacts).not.toHaveBeenCalled()
    expect(h.ridesRepository.saveTimeout).not.toHaveBeenCalled()
    expect(h.ridesRepository.saveAcceptance).not.toHaveBeenCalled()
    expect(h.notificationsRepository.addForStaff).not.toHaveBeenCalled()
    expect(h.rideQueries.getDetails).not.toHaveBeenCalled()
  })

  test.each<Partial<RideRequestState>>([
    { status: "accepted" },
    { driverId: "other-driver" },
    { acceptedDispatch: new AcceptedDispatch("other-driver", now) },
  ])("rejects an existing assignment: %j", async (state) => {
    const h = createHarness(state)

    expect(await h.service.acceptRide(input)).toEqual({
      kind: "alreadyAssigned",
    })
    expect(h.eligibilityQuery.getFacts).not.toHaveBeenCalled()
    expect(h.ridesRepository.saveTimeout).not.toHaveBeenCalled()
    expect(h.ridesRepository.saveAcceptance).not.toHaveBeenCalled()
    expect(h.notificationsRepository.addForStaff).not.toHaveBeenCalled()
    expect(h.rideQueries.getDetails).not.toHaveBeenCalled()
  })

  test.each([now, new Date("2030-01-15T11:59:59Z")])(
    "persists and commits a timeout when pickup is at or before now: %s",
    async (requestedPickupAt) => {
      const h = createHarness({ requestedPickupAt })

      expect(await h.service.acceptRide(input)).toEqual({ kind: "timedOut" })
      expect(h.ride.status).toBe("timed_out")
      expect(h.ridesRepository.saveTimeout).toHaveBeenCalledExactlyOnceWith(
        h.ride,
        h.transaction
      )
      expect(h.lifecycle.committed).toBe(true)
      expect(h.eligibilityQuery.getFacts).not.toHaveBeenCalled()
      expect(h.ridesRepository.saveAcceptance).not.toHaveBeenCalled()
      expect(h.notificationsRepository.addForStaff).not.toHaveBeenCalled()
      expect(h.rideQueries.getDetails).not.toHaveBeenCalled()
    }
  )

  test("passes the ride requirements and driver facts to the policy and rejects ineligibility", async () => {
    const h = createHarness()
    h.policy.evaluate.mockReturnValue("notEligible")

    expect(await h.service.acceptRide(input)).toEqual({ kind: "notEligible" })
    expect(h.eligibilityQuery.getFacts).toHaveBeenCalledExactlyOnceWith(
      rideId,
      driverId,
      h.transaction
    )
    expect(h.policy.evaluate).toHaveBeenCalledExactlyOnceWith(
      h.ride.requirements,
      h.facts
    )
    expect(h.ride.status).toBe("requested")
    expect(h.ride.driverId).toBeNull()
    expect(h.ridesRepository.saveAcceptance).not.toHaveBeenCalled()
    expect(h.rideQueries.getNotificationContext).not.toHaveBeenCalled()
    expect(h.notificationsRepository.addForStaff).not.toHaveBeenCalled()
    expect(h.rideQueries.getDetails).not.toHaveBeenCalled()
  })

  test("returns notEligible when the final persistence guard rejects the claim", async () => {
    const h = createHarness()
    h.ridesRepository.saveAcceptance.mockResolvedValue(false)

    expect(await h.service.acceptRide(input)).toEqual({ kind: "notEligible" })
    expect(h.ridesRepository.saveAcceptance).toHaveBeenCalledExactlyOnceWith(
      h.ride,
      h.transaction
    )
    expect(h.rideQueries.getNotificationContext).not.toHaveBeenCalled()
    expect(h.notificationsRepository.addForStaff).not.toHaveBeenCalled()
    expect(h.rideQueries.getDetails).not.toHaveBeenCalled()
  })

  test("saves the assignment and staff notification in one transaction, then reads details after commit", async () => {
    const h = createHarness()
    h.ridesRepository.saveAcceptance.mockImplementation(async (ride) => {
      expect(h.lifecycle.committed).toBe(false)
      expect(ride.status).toBe("accepted")
      expect(ride.driverId).toBe(driverId)
      expect(ride.acceptedDispatch?.driverId).toBe(driverId)
      expect(ride.acceptedDispatch?.acceptedAt).toEqual(now)
      return true
    })
    h.notificationsRepository.addForStaff.mockImplementation(async () => {
      expect(h.lifecycle.committed).toBe(false)
      expect(h.ridesRepository.saveAcceptance).toHaveBeenCalledTimes(1)
    })
    h.rideQueries.getDetails.mockImplementation(async () => {
      expect(h.lifecycle.committed).toBe(true)
      expect(h.notificationsRepository.addForStaff).toHaveBeenCalledTimes(1)
      return h.details
    })

    expect(await h.service.acceptRide(input)).toEqual({
      kind: "accepted",
      ride: h.details,
    })
    expect(h.database.transaction).toHaveBeenCalledTimes(1)
    expect(h.execute).toHaveBeenCalledTimes(1)
    expect(h.clock.now).toHaveBeenCalledTimes(1)
    expect(h.ridesRepository.findForAcceptance).toHaveBeenCalledExactlyOnceWith(
      rideId,
      h.transaction
    )
    expect(h.eligibilityQuery.getFacts).toHaveBeenCalledExactlyOnceWith(
      rideId,
      driverId,
      h.transaction
    )
    expect(h.ridesRepository.saveAcceptance).toHaveBeenCalledExactlyOnceWith(
      h.ride,
      h.transaction
    )
    expect(h.ridesRepository.saveTimeout).not.toHaveBeenCalled()
    expect(
      h.rideQueries.getNotificationContext
    ).toHaveBeenCalledExactlyOnceWith(rideId, h.transaction)
    expect(
      h.notificationsRepository.addForStaff
    ).toHaveBeenCalledExactlyOnceWith(
      {
        staffId: "staff-1",
        rideId,
        title: "Driver assigned",
        message: expect.stringContaining(
          "Home to Clinic. Return leg, 2 passengers."
        ),
        actionUrl: "/rides/ride-1",
        metadata: { passengerCount: 2, tripLeg: "return" },
      },
      h.transaction
    )
    expect(h.rideQueries.getDetails).toHaveBeenCalledExactlyOnceWith(rideId)
  })

  test("accepts without a notification when notification context is missing", async () => {
    const h = createHarness()
    h.rideQueries.getNotificationContext.mockResolvedValue(null)

    expect(await h.service.acceptRide(input)).toEqual({
      kind: "accepted",
      ride: h.details,
    })
    expect(h.lifecycle.committed).toBe(true)
    expect(h.notificationsRepository.addForStaff).not.toHaveBeenCalled()
  })

  test("preserves a null post-commit details lookup as an accepted result", async () => {
    const h = createHarness()
    h.rideQueries.getDetails.mockResolvedValue(null)

    expect(await h.service.acceptRide(input)).toEqual({
      kind: "accepted",
      ride: null,
    })
    expect(h.lifecycle.committed).toBe(true)
  })

  test("maps an assignment conflict to alreadyAssigned without reading details", async () => {
    const h = createHarness()
    h.ridesRepository.saveAcceptance.mockRejectedValue(
      new RideAssignmentConflict("A competing driver accepted the ride")
    )

    expect(await h.service.acceptRide(input)).toEqual({
      kind: "alreadyAssigned",
    })
    expect(h.lifecycle.committed).toBe(false)
    expect(h.notificationsRepository.addForStaff).not.toHaveBeenCalled()
    expect(h.rideQueries.getDetails).not.toHaveBeenCalled()
  })

  test.each([
    "findForAcceptance",
    "getFacts",
    "saveAcceptance",
    "getNotificationContext",
    "addForStaff",
  ] as const)(
    "propagates a %s failure so the transaction can abort",
    async (method) => {
      const h = createHarness()
      const error = new Error(`${method} failed`)
      const operations = {
        findForAcceptance: h.ridesRepository.findForAcceptance,
        getFacts: h.eligibilityQuery.getFacts,
        saveAcceptance: h.ridesRepository.saveAcceptance,
        getNotificationContext: h.rideQueries.getNotificationContext,
        addForStaff: h.notificationsRepository.addForStaff,
      }
      operations[method].mockRejectedValue(error)

      await expect(h.service.acceptRide(input)).rejects.toBe(error)
      expect(h.lifecycle.committed).toBe(false)
      expect(h.rideQueries.getDetails).not.toHaveBeenCalled()
    }
  )

  test("propagates a timeout write failure instead of returning timedOut", async () => {
    const h = createHarness({ requestedPickupAt: now })
    const error = new Error("Timeout write failed")
    h.ridesRepository.saveTimeout.mockRejectedValue(error)

    await expect(h.service.acceptRide(input)).rejects.toBe(error)
    expect(h.lifecycle.committed).toBe(false)
    expect(h.rideQueries.getDetails).not.toHaveBeenCalled()
  })

  test("propagates a details lookup failure after the acceptance has committed", async () => {
    const h = createHarness()
    const error = new Error("Details lookup failed")
    h.rideQueries.getDetails.mockRejectedValue(error)

    await expect(h.service.acceptRide(input)).rejects.toBe(error)
    expect(h.lifecycle.committed).toBe(true)
    expect(h.notificationsRepository.addForStaff).toHaveBeenCalledTimes(1)
  })
})

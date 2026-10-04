import type { Ride } from "./types"

// Group only visible rides: filtering must never reveal another driver's leg.
export function groupRideAppointments(rides: Ride[]): Ride[][] {
  const parents = new Map(rides.map((ride) => [ride.id, ride.id]))
  const root = (id: string): string => {
    const parent = parents.get(id)!
    if (parent === id) return id
    const result = root(parent)
    parents.set(id, result)
    return result
  }
  const join = (a: string, b: string) => parents.set(root(b), root(a))
  const tripIds = new Map<string, string>()
  for (const ride of rides) {
    if (ride.linked_ride_id && parents.has(ride.linked_ride_id))
      join(ride.id, ride.linked_ride_id)
    if (ride.trip_group_id) {
      const other = tripIds.get(ride.trip_group_id)
      if (other) join(ride.id, other)
      else tripIds.set(ride.trip_group_id, ride.id)
    }
  }
  const groups = new Map<string, Ride[]>()
  for (const ride of rides) {
    const key = root(ride.id)
    const group = groups.get(key) ?? []
    group.push(ride)
    groups.set(key, group)
  }
  return [...groups.values()].map((group) =>
    group.sort((a, b) => {
      if (a.trip_leg === "outbound" && b.trip_leg === "return") return -1
      if (a.trip_leg === "return" && b.trip_leg === "outbound") return 1
      return a.requested_pickup_at.localeCompare(b.requested_pickup_at)
    })
  )
}

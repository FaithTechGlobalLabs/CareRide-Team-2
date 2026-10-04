import type {
  Data,
  Session,
  Ride,
  Driver,
  Availability,
  Verification,
} from "./types"

const KEY = "careride-screen-demo-v2"
const org = {
  id: "org_belkin",
  name: "Belkin Communities of Hope",
  type: "partner_org" as const,
  address: "228 W. 5th Ave, Vancouver",
}
const demoDrivers: Driver[] = [
  {
    id: "driver_olive",
    name: "Olive Demo",
    email: "olive.demo@careride.local",
    phone: "604-555-0102",
    vehicle: {
      make: "Toyota",
      model: "Corolla",
      plate: "CR1234",
      seats: 3,
      wheelchair_accessible: false,
    },
  },
  {
    id: "driver_derek",
    name: "Derek Demo",
    email: "derek.demo@careride.local",
    phone: "604-555-0103",
    vehicle: {
      make: "Honda",
      model: "Civic",
      plate: "CR2201",
      seats: 3,
      wheelchair_accessible: false,
    },
  },
  {
    id: "driver_kenton",
    name: "Kenton Demo",
    email: "kenton.demo@careride.local",
    phone: "604-555-0104",
    vehicle: {
      make: "Kia",
      model: "Carnival",
      plate: "CR2202",
      seats: 6,
      wheelchair_accessible: true,
    },
  },
  {
    id: "driver_eshean",
    name: "Eshean Demo",
    email: "eshean.demo@careride.local",
    phone: "604-555-0105",
    vehicle: {
      make: "Subaru",
      model: "Outback",
      plate: "CR2203",
      seats: 4,
      wheelchair_accessible: false,
    },
  },
]
const driver = demoDrivers[0]
const demoStaff = [
  {
    id: "staff_alvin",
    name: "Alvin Demo",
    email: "alvin.demo@careride.local",
    role: "admin" as const,
  },
  {
    id: "staff_aretha",
    name: "Aretha Franklin",
    email: "aretha.demo@careride.local",
    role: "staff" as const,
  },
  {
    id: "staff_billy",
    name: "Billy Bob Joe",
    email: "billy.demo@careride.local",
    role: "staff" as const,
  },
]
const now = () => new Date().toISOString()
const id = () => crypto.randomUUID()
function seed(): Data {
  const pickup = new Date()
  pickup.setDate(pickup.getDate() + 1)
  pickup.setHours(14, 0, 0, 0)
  const base = {
    client_id: "client_jamie",
    organization_id: org.id,
    requested_by_user_id: "staff_alvin",
    pickup_address: org.address,
    pickup_lat: 49.2665,
    pickup_lng: -123.1128,
    destination_id: "dest_stpauls",
    destination_address: "1081 Burrard St, Vancouver",
    destination_lat: 49.2806,
    destination_lng: -123.128,
    passenger_count: 1,
    created_at: now(),
    waiting_minutes: 15,
  }
  return {
    clients: [
      {
        id: "client_jamie",
        first_name: "Jamie",
        last_name: "Chen",
        dob: "1984-09-03",
        has_smartphone: false,
        address: org.address,
        notes: "Prefers the side door",
      },
      {
        id: "client_chong",
        first_name: "Chong",
        last_name: "Demo",
        dob: "1991-06-18",
        has_smartphone: true,
        address: org.address,
        phone: "604-555-0196",
        notes: "Demo client record",
      },
      {
        id: "client_winnie",
        first_name: "Winnie",
        last_name: "Demo",
        dob: "1989-10-09",
        has_smartphone: true,
        address: org.address,
        phone: "604-555-0197",
        notes: "Demo client record",
      },
      {
        id: "client_joe",
        first_name: "Joe",
        last_name: "Demo",
        dob: "1975-01-24",
        has_smartphone: false,
        address: org.address,
        phone: "604-555-0198",
        notes: "Demo client record",
      },
    ],
    destinations: [
      {
        id: "dest_belkin",
        name: "Belkin House",
        type: "shelter",
        address: org.address,
        lat: 49.2665,
        lng: -123.1128,
        is_active: true,
      },
      {
        id: "dest_stpauls",
        name: "St. Paul's Hospital",
        type: "hospital",
        address: base.destination_address,
        lat: 49.2806,
        lng: -123.128,
        is_active: true,
      },
    ],
    rides: [
      {
        ...base,
        id: "ride_demo",
        status: "requested",
        requested_pickup_at: pickup.toISOString(),
        notes: "Sample request for the screen walkthrough.",
        sample: true,
      },
      {
        ...base,
        id: "ride_sample",
        status: "completed",
        requested_pickup_at: new Date(Date.now() - 86400000).toISOString(),
        completed_at: new Date(Date.now() - 85000000).toISOString(),
        driver_id: driver.id,
        driver,
        sample: true,
        estimated_cost_saved: 22,
      },
    ],
    availableRides: [],
    organizations: [
      org,
      {
        id: "org_provider",
        name: "Community Transport",
        type: "transport_provider",
        address: "Vancouver, BC",
      },
    ],
    verifications: demoDrivers.map((item) => ({
      id: `ver_${item.id.replace("driver_", "")}`,
      driver_id: item.id,
      driver: item,
      approved_by_org_id: org.id,
      organization: org,
      check_type: "identity",
      status: "approved",
    })),
    availability: demoDrivers.map((item, index) => ({
      id: `avail_${item.id.replace("driver_", "")}`,
      driver_id: item.id,
      centre_lat: 49.2665,
      centre_lng: -123.1128,
      radius_km: 25 + index * 5,
      kind: "weekly",
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      start_time: "06:00",
      end_time: "22:00",
      timezone: "America/Vancouver",
      minimum_notice_minutes: 0,
      max_wait_minutes: 15,
      is_active: true,
    })),
    notifications: [],
    summary: {
      completed_rides: 1,
      estimated_cost_saved: 22,
      staff_minutes_saved: 12,
    },
  }
}
export function readDemo(): Data {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return JSON.parse(saved) as Data
  } catch {
    /* Start fresh if browser data is unavailable. */
  }
  return seed()
}
function save(data: Data) {
  localStorage.setItem(KEY, JSON.stringify(data))
}
function eligible(ride: Ride, data: Data, activeDriver = driver) {
  const date = new Date(ride.requested_pickup_at)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Vancouver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date)
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    p.weekday
  )
  const time = `${p.hour}:${p.minute}`
  const localDate = `${p.year}-${p.month}-${p.day}`
  return (
    ride.status === "requested" &&
    data.verifications.some(
      (v) =>
        v.driver_id === activeDriver.id &&
        v.approved_by_org_id === ride.organization_id &&
        v.status === "approved" &&
        (!v.expires_on || v.expires_on >= localDate)
    ) &&
    ride.passenger_count <= (activeDriver.vehicle?.seats ?? 0) &&
    (!ride.accessibility_needs?.toLowerCase().includes("wheelchair") ||
      activeDriver.vehicle?.wheelchair_accessible) &&
    data.availability
      .filter((a) => a.driver_id === activeDriver.id)
      .some((a) => {
        const rad = Math.PI / 180
        const dLat = (ride.pickup_lat - a.centre_lat) * rad
        const dLng = (ride.pickup_lng - a.centre_lng) * rad
        const hav =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(a.centre_lat * rad) *
            Math.cos(ride.pickup_lat * rad) *
            Math.sin(dLng / 2) ** 2
        const distance =
          6371 * 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav))
        return (
          a.is_active &&
          distance <= a.radius_km &&
          date.getTime() >= Date.now() + a.minimum_notice_minutes * 60000 &&
          time >= a.start_time &&
          time <= a.end_time &&
          (!a.starts_on || localDate >= a.starts_on) &&
          (!a.ends_on || localDate <= a.ends_on) &&
          ((a.kind === "one_time" && localDate === a.on_date) ||
            (a.kind === "weekly" && a.weekdays?.includes(day)))
        )
      })
  )
}
export async function demoRequest(
  path: string,
  method: string,
  body: unknown,
  session: Session | null
): Promise<unknown> {
  const data = readDemo()
  const b =
    body instanceof FormData
      ? Object.fromEntries(body.entries())
      : ((body ?? {}) as Record<string, unknown>)
  if (path === "/auth/login") {
    const selectedDriver = demoDrivers.find(
      (item) => item.email === String(b.email)
    )
    const selectedStaff = demoStaff.find(
      (item) => item.email === String(b.email)
    )
    if (b.password !== "CareRideDemo1" || (!selectedStaff && !selectedDriver))
      throw new Error("Use a demo account below with password CareRideDemo1.")
    const isDriver = !!selectedDriver
    return {
      token: "screen-demo",
      user: {
        id: selectedDriver?.id ?? selectedStaff!.id,
        name: selectedDriver?.name ?? selectedStaff!.name,
        email: b.email,
        role: isDriver ? "driver" : selectedStaff!.role,
        organization_id: isDriver ? undefined : org.id,
      },
      organization: isDriver ? undefined : org,
    }
  }
  if (path.endsWith("/register")) {
    if (path === "/organizations/register") {
      const organization = {
        id: id(),
        name: String(b.name),
        type: b.type as "partner_org",
        address: String(b.address),
      }
      data.organizations.push(organization)
      save(data)
      return {
        token: "screen-demo",
        user: {
          id: id(),
          name: b.admin_name,
          email: b.admin_email,
          role: "admin",
          organization_id: organization.id,
        },
        organization,
      }
    }
    return {
      token: "screen-demo",
      user: { id: id(), name: b.name, email: b.email, role: "driver" },
    }
  }
  if (method === "GET") {
    if (path === "/organizations") return data.organizations
    if (path === "/clients") return data.clients
    if (path === "/destinations") return data.destinations
    if (path === "/rides") return data.rides
    if (path === "/drivers/me/rides")
      return data.rides.filter((r) => r.driver_id === session?.user.id)
    if (path === "/drivers/me/rides/available") {
      const activeDriver = demoDrivers.find(
        (item) => item.id === session?.user.id
      )
      return activeDriver
        ? data.rides.filter((r) => eligible(r, data, activeDriver))
        : []
    }
    if (path === "/drivers/me/availability")
      return session?.user.id === driver.id ? data.availability : []
    if (path === "/drivers/me/verifications")
      return data.verifications.filter((v) => v.driver_id === session?.user.id)
    if (path === "/admin/verifications") return data.verifications
    if (path === "/notifications") return data.notifications
    if (path === "/admin/demo-summary")
      return {
        completed_rides: data.rides.filter((r) => r.status === "completed")
          .length,
        estimated_cost_saved: 22,
        staff_minutes_saved: 12,
      }
    if (path.startsWith("/rides/"))
      return data.rides.find((r) => r.id === path.split("/")[2])
  }
  const notice = (ride: Ride, type: string) =>
    data.notifications.unshift({
      id: id(),
      ride_request_id: ride.id,
      type,
      sent_at: now(),
    })
  let result: unknown
  if (path === "/rides" && method === "POST") {
    const ride = {
      ...b,
      id: id(),
      status: "requested",
      created_at: now(),
      requested_by_user_id: session?.user.id,
      organization_id: session?.user.organization_id ?? org.id,
    } as unknown as Ride
    data.rides.unshift(ride)
    notice(ride, "confirmation")
    result = ride
    if (b.trip_type === "round_trip") {
      const back = {
        ...ride,
        id: id(),
        pickup_address: ride.destination_address,
        pickup_lat: ride.destination_lat!,
        pickup_lng: ride.destination_lng!,
        destination_address: ride.pickup_address,
        destination_lat: ride.pickup_lat,
        destination_lng: ride.pickup_lng,
        requested_pickup_at: String(b.return_pickup_at),
        linked_ride_id: ride.id,
        trip_leg: "return",
      }
      ride.linked_ride_id = back.id
      ride.trip_leg = "outbound"
      data.rides.unshift(back)
      notice(back, "confirmation")
      result = [ride, back]
    }
  } else if (path.startsWith("/rides/")) {
    const ride = data.rides.find((r) => r.id === path.split("/")[2])
    if (!ride) throw new Error("Ride not found.")
    const action = path.split("/")[3]
    if (method === "PATCH") {
      if (ride.status !== "requested")
        throw new Error("This ride can no longer be edited.")
      Object.assign(ride, b)
    } else if (action === "accept") {
      if (ride.status !== "requested")
        throw new Error("Another driver has already accepted this ride.")
      const activeDriver = demoDrivers.find(
        (item) => item.id === session?.user.id
      )
      if (!activeDriver || !eligible(ride, data, activeDriver))
        throw new Error(
          "This ride no longer matches your approval, capacity, or availability."
        )
      ride.status = "accepted"
      ride.driver_id = session?.user.id
      ride.driver = activeDriver
      ride.accepted_at = now()
      ride.waiting_minutes = data.availability.find(
        (a) => a.is_active
      )?.max_wait_minutes
      notice(ride, "driver_assigned")
    } else if (action === "cancel") {
      if (!["requested", "accepted"].includes(ride.status))
        throw new Error("This ride can no longer be cancelled.")
      ride.status = "cancelled"
      ride.cancelled_reason = String(b.reason)
      notice(ride, "cancelled")
    } else {
      if (ride.driver_id !== session?.user.id)
        throw new Error("Only the assigned driver can update this ride.")
      if (action === "pickup" && ride.status === "accepted") {
        ride.status = "in_progress"
        ride.picked_up_at = now()
      } else if (action === "dropoff" && ride.status === "in_progress") {
        ride.status = "completed"
        ride.completed_at = now()
        notice(ride, "completed")
      } else if (action === "no-show" && ride.status === "accepted")
        ride.status = "no_show"
      else if (action === "withdraw" && ride.status === "accepted") {
        ride.status = "requested"
        delete ride.driver_id
        delete ride.driver
        delete ride.accepted_at
      } else
        throw new Error("This action is no longer available. Refresh the ride.")
    }
    result = ride
  } else if (
    path.startsWith("/clients") ||
    path.startsWith("/destinations") ||
    path.startsWith("/drivers/me/availability")
  ) {
    const collection = path.startsWith("/clients")
      ? data.clients
      : path.startsWith("/destinations")
        ? data.destinations
        : data.availability
    const itemId = path.split("/").at(-1)
    const item = collection.find((x) => x.id === itemId)
    if (method === "DELETE") {
      data.availability = data.availability.filter((a) => a.id !== itemId)
    } else if (item) {
      Object.assign(item, b)
      result = item
    } else {
      const created = { ...b, id: id() }
      ;(collection as unknown[]).push(created)
      result = created
    }
  } else if (path === "/drivers/me/verifications") {
    const record = {
      id: id(),
      driver_id: session!.user.id,
      driver: {
        id: session!.user.id,
        name: session!.user.name,
        email: session!.user.email,
        phone: "",
      },
      approved_by_org_id: String(b.approved_by_org_id),
      check_type: String(b.check_type),
      status: "pending",
      issued_on: String(b.issued_on || ""),
      expires_on: String(b.expires_on || ""),
      document_ref: b.document instanceof File ? b.document.name : "",
    } as Verification
    data.verifications.unshift(record)
    result = record
  } else if (path.startsWith("/admin/verifications/")) {
    const record = data.verifications.find((v) => v.id === path.split("/")[3])
    if (!record) throw new Error("Verification not found.")
    record.status = path.endsWith("/approve") ? "approved" : "rejected"
    record.reject_reason = String(b.reason || "")
    result = record
  } else if (path.startsWith("/notifications/")) {
    const n = data.notifications.find((n) => n.id === path.split("/")[2])
    if (n) n.read_at = now()
  } else throw new Error("This screen action is not supported in the demo.")
  save(data)
  return result
}
export type DemoAvailability = Availability

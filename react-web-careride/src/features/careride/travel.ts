import { useEffect, useRef, useState } from "react"
import type { Destination, Ride } from "./types"

export type LatLng = { lat: number; lng: number }

export type TravelEstimate = {
  minutes: number
  kilometers: number
}

export async function getTravelTime(
  origin: LatLng,
  destination: LatLng
): Promise<TravelEstimate | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  const data = (await response.json()) as {
    code?: string
    routes?: { duration: number; distance: number }[]
  }
  const route = data.code === "Ok" ? data.routes?.[0] : undefined
  if (!route) return null
  return {
    minutes: Math.max(1, Math.round(route.duration / 60)),
    kilometers: route.distance / 1000,
  }
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  const hits = (await response.json()) as { lat?: string; lon?: string }[]
  const hit = hits[0]
  if (!hit?.lat || !hit.lon) return null
  const lat = Number(hit.lat)
  const lng = Number(hit.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export function formatKm(kilometers: number) {
  return `${kilometers.toFixed(1)} km`
}

const travelCache = new Map<string, Promise<TravelEstimate | null>>()
const geoCache = new Map<string, Promise<LatLng | null>>()

function routeKey(origin: LatLng, destination: LatLng) {
  const pin = (point: LatLng) =>
    `${point.lat.toFixed(4)},${point.lng.toFixed(4)}`
  return `${pin(origin)}>${pin(destination)}`
}

export function cachedTravelTime(origin: LatLng, destination: LatLng) {
  const key = routeKey(origin, destination)
  let pending = travelCache.get(key)
  if (!pending) {
    pending = getTravelTime(origin, destination).catch(() => null)
    travelCache.set(key, pending)
  }
  return pending
}

function cachedGeocode(address: string) {
  const key = address.trim().toLowerCase()
  let pending = geoCache.get(key)
  if (!pending) {
    pending = geocodeAddress(address).catch(() => null)
    geoCache.set(key, pending)
  }
  return pending
}

function knownPoint(
  lat: number | undefined,
  lng: number | undefined,
  named?: Destination
): LatLng | null {
  if (named && Number.isFinite(named.lat) && Number.isFinite(named.lng)) {
    return { lat: named.lat, lng: named.lng }
  }
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng }
  }
  return null
}

async function resolvePoint(
  lat: number | undefined,
  lng: number | undefined,
  address: string,
  named?: Destination
) {
  return knownPoint(lat, lng, named) ?? (address ? cachedGeocode(address) : null)
}

export function useDriveTimes(rides: Ride[], destinations: Destination[]) {
  const [times, setTimes] = useState<Record<string, TravelEstimate>>({})
  const key = rides
    .map(
      (ride) =>
        `${ride.id}:${ride.pickup_lat},${ride.pickup_lng}:${ride.destination_lat},${ride.destination_lng}:${ride.pickup_address}:${ride.destination_address}`
    )
    .sort()
    .join("|")
  const ridesRef = useRef(rides)
  const destinationsRef = useRef(destinations)
  ridesRef.current = rides
  destinationsRef.current = destinations

  useEffect(() => {
    const current = ridesRef.current
    const places = destinationsRef.current
    if (!current.length) return
    let cancel = false
    void (async () => {
      const groups = new Map<
        string,
        { origin: LatLng; destination: LatLng; ids: string[] }
      >()
      for (const ride of current) {
        const pickup = places.find(
          (item) =>
            item.id === ride.pickup_id || item.address === ride.pickup_address
        )
        const dropoff = places.find(
          (item) =>
            item.id === ride.destination_id ||
            item.address === ride.destination_address
        )
        const origin = await resolvePoint(
          ride.pickup_lat,
          ride.pickup_lng,
          ride.pickup_address,
          pickup
        )
        const destination = await resolvePoint(
          ride.destination_lat,
          ride.destination_lng,
          ride.destination_address,
          dropoff
        )
        if (!origin || !destination) continue
        const id = routeKey(origin, destination)
        const group = groups.get(id) ?? { origin, destination, ids: [] }
        group.ids.push(ride.id)
        groups.set(id, group)
      }
      const next: Record<string, TravelEstimate> = {}
      await Promise.all(
        [...groups.values()].map(async (group) => {
          const estimate = await cachedTravelTime(group.origin, group.destination)
          if (!estimate) return
          for (const id of group.ids) next[id] = estimate
        })
      )
      if (!cancel) setTimes(next)
    })()
    return () => {
      cancel = true
    }
  }, [key])

  return times
}

import type { Data, Notice, Ride, Session } from "./types"

export type NotificationChoice = "ask" | "later" | "off" | "enabled"

const key = (userId: string, kind: string) => `careride:${userId}:${kind}`

export function readChoice(userId: string): NotificationChoice {
  const value = localStorage.getItem(key(userId, "notification-choice"))
  return value === "later" || value === "off" || value === "enabled"
    ? value
    : "ask"
}

export function saveChoice(userId: string, choice: NotificationChoice) {
  localStorage.setItem(key(userId, "notification-choice"), choice)
  window.dispatchEvent(new Event("careride-notification-choice"))
}

export function readDriverReads(userId: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(userId, "driver-reads")) ?? "[]")
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : []
  } catch {
    return []
  }
}

export function markDriverRead(userId: string, noticeId: string) {
  const reads = new Set(readDriverReads(userId))
  reads.add(noticeId)
  localStorage.setItem(key(userId, "driver-reads"), JSON.stringify([...reads].slice(-300)))
  window.dispatchEvent(new Event("careride-driver-reads"))
}

export function driverNotices(rides: Ride[], userId: string): Notice[] {
  const reads = new Set(readDriverReads(userId))
  return rides.map((ride) => {
    const id = `available:${ride.id}`
    return {
      id,
      ride_request_id: ride.id,
      type: "available_ride",
      message: `A ride to ${ride.destination_name || ride.destination_address} matches your availability.`,
      sent_at: ride.created_at,
      read_at: reads.has(id) ? ride.created_at : undefined,
    }
  })
}

export function noticesForSession(data: Data, session: Session): Notice[] {
  return session.user.role === "driver"
    ? driverNotices(data.availableRides, session.user.id)
    : data.notifications
}

export function nativeMessage(notice: Notice, session: Session) {
  if (session.user.role === "driver") {
    return { title: "A ride is available", body: "A request matches your availability. Open CareRide to review it." }
  }
  const title = notice.type === "driver_assigned"
    ? "A driver accepted a ride"
    : notice.type === "completed"
      ? "A client journey was completed"
      : notice.type === "cancelled"
        ? "A ride was cancelled"
        : "A client ride was updated"
  return { title, body: "Open CareRide to see the latest update." }
}

export function rememberNewNotices(userId: string, notices: Notice[]): Notice[] {
  const storageKey = key(userId, "seen-notices")
  let previous: string[] | null = null
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      if (Array.isArray(parsed)) previous = parsed.filter((id): id is string => typeof id === "string")
    }
  } catch {
    // A damaged local cache should never prevent the inbox from loading.
  }
  const seen = new Set(previous ?? [])
  const fresh = previous ? notices.filter((notice) => !seen.has(notice.id)) : []
  localStorage.setItem(storageKey, JSON.stringify([...new Set([...seen, ...notices.map((notice) => notice.id)])].slice(-500)))
  return fresh
}

export async function showNativeNotice(notice: Notice, session: Session) {
  if (!("Notification" in window) || Notification.permission !== "granted") return
  const { title, body } = nativeMessage(notice, session)
  const options: NotificationOptions = {
    body,
    icon: "/pwa-192x192.png",
    tag: `careride-${notice.id}`,
    data: { path: `/rides/${encodeURIComponent(notice.ride_request_id)}` },
  }
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/notification-sw.js")
      await registration.showNotification(title, options)
      return
    } catch {
      // Desktop browsers can still display an active-page notification.
    }
  }
  try {
    const notification = new Notification(title, options)
    notification.onclick = () => {
      window.focus()
      window.location.assign(`/rides/${encodeURIComponent(notice.ride_request_id)}`)
    }
  } catch {
    // Permission can change between checking and displaying a notification.
  }
}

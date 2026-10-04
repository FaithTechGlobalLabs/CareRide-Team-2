import { useEffect, useState } from "react"
import { Bell, BellOff } from "lucide-react"
import { useCare } from "./context"
import { IS_DEMO, request } from "./api"
import { ErrorBox } from "./ui"
import type { Session } from "./types"

interface Preferences {
  push_enabled: boolean
  updates_enabled: boolean
  available_rides_enabled: boolean
  prompt_after: string
  prompt_dismissed: boolean
  configured: boolean
  public_key: string | null
  first_ride_prompt_pending?: boolean
}
const supported = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  "Notification" in window &&
  "PushManager" in window &&
  "serviceWorker" in navigator

export async function disableDevice(session: Session) {
  if (!("serviceWorker" in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration("/")
  const sub = await registration?.pushManager.getSubscription()
  if (!sub) return
  try {
    await request("/notifications/subscriptions", session, "DELETE", {
      endpoint: sub.endpoint,
    })
  } finally {
    await sub.unsubscribe()
  }
}

export function NotificationControls({
  gentle = false,
  afterAcceptance = false,
}: {
  gentle?: boolean
  afterAcceptance?: boolean
}) {
  const { session } = useCare()
  const [prefs, setPrefs] = useState<Preferences | null>(null)
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    supported() ? Notification.permission : "default"
  )
  const [onDevice, setOnDevice] = useState(false)
  const [now, setNow] = useState(Date.now)
  const driver = session?.user.role === "driver"
  useEffect(() => {
    if (!session || IS_DEMO) return
    let live = true
    void request<Preferences>("/notifications/preferences", session)
      .then(async (p) => {
        if (!live) return
        setPrefs(p)
        if (supported() && p.configured) {
          await navigator.serviceWorker.register("/notifications-sw.js", {
            scope: "/",
          })
          const sw = await navigator.serviceWorker.ready
          if (!live) return
          setRegistration(sw)
          const sub = await sw.pushManager.getSubscription()
          setOnDevice(
            !!sub && p.push_enabled && Notification.permission === "granted"
          )
          if (sub && p.push_enabled && Notification.permission === "granted")
            await request(
              "/notifications/subscriptions",
              session,
              "POST",
              sub.toJSON()
            )
        }
      })
      .catch((e) => {
        if (live) setError(e.message)
      })
    const timer = setInterval(() => setNow(Date.now()), 60000)
    const focus = () => {
      if (supported()) setPermission(Notification.permission)
    }
    window.addEventListener("focus", focus)
    return () => {
      live = false
      clearInterval(timer)
      window.removeEventListener("focus", focus)
    }
  }, [session])

  async function save(body: object) {
    if (!session) return
    const next = await request<Preferences>(
      "/notifications/preferences",
      session,
      "PATCH",
      body
    )
    setPrefs(next)
    return next
  }
  async function action(fn: () => Promise<unknown>) {
    setBusy(true)
    setError("")
    try {
      await fn()
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save notification settings."
      )
    } finally {
      setBusy(false)
    }
  }
  async function enable() {
    if (!session || !registration || !prefs?.public_key || !supported()) return
    // This must be the first asynchronous call after the user's click (Safari).
    const granted = await Notification.requestPermission()
    setPermission(granted)
    if (granted !== "granted") {
      await save({
        push_enabled: false,
        prompt: granted === "denied" ? "declined" : "later",
      })
      return
    }
    const bytes = Uint8Array.from(
      atob(prefs.public_key.replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0)
    )
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription)
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      })
    try {
      await request(
        "/notifications/subscriptions",
        session,
        "POST",
        subscription.toJSON()
      )
      await save({ push_enabled: true, prompt: "accepted" })
      setOnDevice(true)
    } catch (e) {
      await subscription.unsubscribe()
      throw e
    }
  }
  if (!session || IS_DEMO)
    return gentle ? null : (
      <p className="muted">Browser notifications require the connected app.</p>
    )
  const eligiblePrompt =
    prefs &&
    !prefs.prompt_dismissed &&
    !prefs.push_enabled &&
    (new Date(prefs.prompt_after).getTime() <= now ||
      (afterAcceptance && prefs.first_ride_prompt_pending)) &&
    permission !== "denied"
  if (gentle && !eligiblePrompt) return null
  if (!prefs)
    return gentle ? null : (
      <>
        <p className="muted">Loading notification preferences…</p>
        <ErrorBox error={error} />
      </>
    )
  return (
    <section
      className={`notification-preferences ${gentle ? "gentle-notification-card" : ""}`}
      aria-label="Notification preferences"
    >
      <div className="notification-preferences-heading">
        <Bell size={22} />
        <div>
          <h3>
            {gentle
              ? `${session.user.name.split(" ")[0]}, would a heads-up help?`
              : "Your notifications"}
          </h3>
          <p>
            {driver
              ? "Get a gentle heads-up when a ride fits your availability and organization approvals."
              : "Stay informed when client details or rides change in your organization."}
          </p>
        </div>
      </div>
      <ErrorBox error={error} />
      {!gentle && (
        <>
          <label className="checkbox">
            <input
              type="checkbox"
              disabled={busy}
              checked={
                driver ? prefs.available_rides_enabled : prefs.updates_enabled
              }
              onChange={(e) =>
                void action(() =>
                  save(
                    driver
                      ? { available_rides_enabled: e.target.checked }
                      : { updates_enabled: e.target.checked }
                  )
                )
              }
            />
            {driver
              ? "Notify me about eligible available rides"
              : "Notify me about client and ride updates"}
          </label>
          <p className="muted">
            Your inbox stays here. Browser notifications can reach you when
            CareRide is closed, and hide client details on your lock screen.
          </p>
        </>
      )}
      {!supported() ? (
        <p className="muted">
          This browser cannot receive push notifications. On iPhone or iPad, add
          CareRide to your Home Screen and open it there. Your inbox still
          works.
        </p>
      ) : !prefs.configured ? (
        <p className="muted">
          Browser notifications are awaiting server configuration. Your inbox
          still works.
        </p>
      ) : permission === "denied" ? (
        <p className="muted">
          Notifications are blocked in this browser. You can allow them in your
          browser or device settings, then return here. We won’t ask again
          automatically.
        </p>
      ) : null}
      <div className="button-row notification-actions">
        {onDevice ? (
          <button
            disabled={busy}
            className="btn secondary"
            onClick={() =>
              void action(async () => {
                await disableDevice(session)
                setOnDevice(false)
              })
            }
          >
            <BellOff size={16} /> Turn off on this device
          </button>
        ) : (
          <button
            disabled={
              busy ||
              !registration ||
              !supported() ||
              !prefs.configured ||
              permission === "denied"
            }
            className="btn primary notification-enable-button"
            onClick={() => void action(enable)}
          >
            <Bell size={16} />
            {busy ? "Saving…" : "Allow device alerts"}
          </button>
        )}
        {gentle && (
          <>
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => void action(() => save({ prompt: "later" }))}
            >
              Maybe later
            </button>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => void action(() => save({ prompt: "declined" }))}
            >
              No thanks
            </button>
          </>
        )}
        {!gentle && prefs.push_enabled && (
          <button
            className="text-link"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await save({ push_enabled: false })
                await request(
                  "/notifications/subscriptions",
                  session,
                  "DELETE",
                  {}
                )
                await disableDevice(session)
                setOnDevice(false)
              })
            }
          >
            Turn off on all devices
          </button>
        )}
      </div>
    </section>
  )
}

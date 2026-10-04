import { useEffect, useState } from "react"
import { Bell, BellOff } from "lucide-react"
import { useCare } from "./context"
import {
  readChoice,
  saveChoice,
  type NotificationChoice,
} from "./notifications"

function permissionState() {
  if (typeof window === "undefined" || !("Notification" in window) || !window.isSecureContext)
    return "unsupported" as const
  return Notification.permission
}

export function useNotificationChoice(userId: string) {
  const [choice, setChoice] = useState<NotificationChoice>(() => readChoice(userId))
  const [permission, setPermission] = useState(permissionState)
  useEffect(() => {
    const update = () => {
      setChoice(readChoice(userId))
      setPermission(permissionState())
    }
    window.addEventListener("careride-notification-choice", update)
    window.addEventListener("storage", update)
    window.addEventListener("focus", update)
    return () => {
      window.removeEventListener("careride-notification-choice", update)
      window.removeEventListener("storage", update)
      window.removeEventListener("focus", update)
    }
  }, [userId])
  return { choice, permission }
}

export function useDriverReadChanges() {
  const [, setVersion] = useState(0)
  useEffect(() => {
    const update = () => setVersion((value) => value + 1)
    window.addEventListener("careride-driver-reads", update)
    window.addEventListener("storage", update)
    return () => {
      window.removeEventListener("careride-driver-reads", update)
      window.removeEventListener("storage", update)
    }
  }, [])
}

export function NotificationControls({ compact = false }: { compact?: boolean }) {
  const { session } = useCare()
  const userId = session?.user.id ?? ""
  const { choice, permission } = useNotificationChoice(userId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  if (!session) return null
  const driver = session.user.role === "driver"
  const roleCopy = driver
    ? "when a ride matches your availability"
    : "when a client’s ride changes"
  if (compact && choice !== "ask") return null

  async function enable() {
    if (permission === "unsupported" || permission === "denied") return
    setBusy(true)
    setError("")
    try {
      // This runs only after the person chooses the button in CareRide.
      const result = await Notification.requestPermission()
      saveChoice(userId, result === "granted" ? "enabled" : "off")
      if (result === "granted" && "serviceWorker" in navigator)
        void navigator.serviceWorker.register("/notification-sw.js").catch(() => {})
    } catch {
      setError("We couldn’t request notifications on this device. You can still use the in-app inbox.")
    } finally {
      setBusy(false)
    }
  }

  const enabled = choice === "enabled" && permission === "granted"
  return (
    <section className={`notification-choice ${compact ? "notification-choice-compact" : ""}`} aria-label="Notification preferences">
      <span className="notification-choice-icon" aria-hidden="true">
        {enabled ? <Bell size={21} /> : <BellOff size={21} />}
      </span>
      <div className="notification-choice-copy">
        <h2>{enabled ? "Device alerts are on" : "Stay in the loop, your way"}</h2>
        <p>
          {permission === "denied"
            ? "Device alerts are blocked in your browser or device settings. Your in-app updates will still appear here."
            : permission === "unsupported"
              ? "Device alerts aren’t available here. Your in-app updates will still appear here."
              : enabled
                ? `We’ll let you know ${roleCopy}. You can turn alerts off at any time.`
                : `Get a device alert ${roleCopy}. You can also check updates here without enabling alerts.`}
        </p>
        {error && <p className="notification-choice-error" role="alert">{error}</p>}
        {permission === "denied" && <p>To enable them later, change CareRide’s notification permission in your browser or device settings.</p>}
      </div>
      <div className="notification-choice-actions">
        {!enabled && permission !== "denied" && permission !== "unsupported" && (
          <button type="button" className="btn primary" disabled={busy} onClick={() => void enable()}>
            {busy ? "Checking…" : "Allow device alerts"}
          </button>
        )}
        {choice === "ask" && (
          <>
            <button type="button" className="btn secondary" onClick={() => saveChoice(userId, "later")}>Maybe later</button>
            <button type="button" className="btn subtle" onClick={() => saveChoice(userId, "off")}>No thanks</button>
          </>
        )}
        {choice !== "ask" && choice !== "off" && (
          <button type="button" className="btn subtle" onClick={() => saveChoice(userId, "off")}>Turn off alerts</button>
        )}
      </div>
    </section>
  )
}

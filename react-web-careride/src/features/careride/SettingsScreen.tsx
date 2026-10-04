import { useState, type FormEvent } from "react"
import { useNavigate } from "@tanstack/react-router"
import { AlertTriangle, Trash2 } from "lucide-react"
import { useCare } from "./context"
import { request, IS_DEMO } from "./api"
import { Layout } from "./Layout"
import { ErrorBox, PageTitle, Panel } from "./ui"
import { NotificationControls, disableDevice } from "./NotificationControls"

export function SettingsScreen() {
  const { session, logout } = useCare()
  const navigate = useNavigate()
  const [target, setTarget] = useState<"account" | "organization" | null>(null)
  const [confirmation, setConfirmation] = useState("")
  const [organizationName, setOrganizationName] = useState("")
  const [password, setPassword] = useState("")
  const [acknowledged, setAcknowledged] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const driver = session?.user.role === "driver"
  const orgName =
    session?.organization?.name ?? session?.user.organization_name ?? ""
  const phrase = target === "organization" ? "DELETE ORGANIZATION" : "DELETE"
  const ready =
    confirmation === phrase &&
    !!password &&
    (target !== "organization" ||
      (orgName !== "" && organizationName === orgName && acknowledged))
  function choose(value: typeof target) {
    setTarget(value)
    setConfirmation("")
    setOrganizationName("")
    setPassword("")
    setAcknowledged(false)
    setError("")
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!ready || !session || !target || busy) return
    setBusy(true)
    setError("")
    try {
      await request(`/settings/${target}`, session, "DELETE", {
        password,
        confirmation,
        organization_name: organizationName,
        acknowledged,
      })
      await disableDevice(session).catch(() => {})
      await logout()
      void navigate({ to: "/login" })
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Deletion failed. Your account is still available."
      )
    } finally {
      setBusy(false)
      setPassword("")
    }
  }
  return (
    <Layout driver={driver}>
      <PageTitle
        title="Your settings"
        description="Manage your notifications, account, and workspace."
      />
      <Panel title="Your account">
        <div className="settings-profile">
          <strong>{session?.user.name}</strong>
          <p>{session?.user.email}</p>
          <small>
            {driver
              ? "Volunteer driver"
              : `Organization staff${orgName ? ` · ${orgName}` : ""}`}
          </small>
        </div>
      </Panel>
      <Panel>
        <NotificationControls />
      </Panel>
      <Panel
        title="Account deletion"
        description="Permanent actions require your password and a typed confirmation."
        className="danger-zone"
      >
        <div className="settings-danger-row">
          <div>
            <h3>Delete my account</h3>
            <p>
              {driver
                ? "Remove your login, vehicle, availability, approval documents, and notifications. Accepted rides return to the available list. Completed ride records stay with the organization without your profile."
                : "Remove your login and notifications. Your organization, its clients, bookings, and other staff accounts stay available."}
            </p>
          </div>
          <button
            className="btn danger"
            disabled={IS_DEMO || busy}
            onClick={() => choose("account")}
          >
            <Trash2 size={16} /> Delete account
          </button>
        </div>
        {!driver && (
          <div className="settings-danger-row">
            <div>
              <h3>Delete the organization</h3>
              <p>
                This permanently deletes all organization staff accounts,
                clients, locations, ride history, and driver approvals. Every
                staff member loses access. Independent driver accounts remain.
              </p>
            </div>
            <button
              className="btn danger"
              disabled={IS_DEMO || busy || !orgName}
              onClick={() => choose("organization")}
            >
              <Trash2 size={16} /> Delete organization
            </button>
          </div>
        )}
        {IS_DEMO && (
          <p className="muted">Deletion is available in the connected app.</p>
        )}
      </Panel>
      {target && (
        <div
          className="install-dialog-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !busy) choose(null)
          }}
        >
          <section
            className={`install-dialog deletion-dialog ${target === "organization" ? "organization-deletion-dialog" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="deletion-title"
          >
            <AlertTriangle className="danger-icon" size={32} />
            <h2 id="deletion-title">
              {target === "organization"
                ? `Permanently delete ${orgName}?`
                : "Permanently delete your account?"}
            </h2>
            <p>
              {target === "organization"
                ? "This erases the entire organization’s data and removes access for every staff member. This cannot be undone."
                : "Your login and personal account data will be removed. This cannot be undone."}
            </p>
            <p className="muted">
              A ride already in progress must be finished before deletion.
            </p>
            <form onSubmit={(e) => void submit(e)}>
              <ErrorBox error={error} />
              {target === "organization" && (
                <>
                  <label className="field">
                    Type the organization name: <strong>{orgName}</strong>
                    <input
                      autoFocus
                      autoComplete="off"
                      value={organizationName}
                      disabled={busy}
                      onChange={(e) => setOrganizationName(e.target.value)}
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      disabled={busy}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                    />
                    I understand that all staff accounts, client records,
                    locations, bookings, and organization approvals will be
                    permanently deleted.
                  </label>
                </>
              )}
              <label className="field">
                Type <strong>{phrase}</strong> to confirm
                <input
                  autoFocus={target === "account"}
                  autoComplete="off"
                  spellCheck={false}
                  value={confirmation}
                  disabled={busy}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </label>
              <label className="field">
                Your current password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  disabled={busy}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <div className="button-row">
                <button
                  type="button"
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => choose(null)}
                >
                  Keep {target === "organization" ? "organization" : "account"}
                </button>
                <button
                  type="submit"
                  className="btn danger"
                  disabled={!ready || busy}
                >
                  {busy
                    ? "Deleting…"
                    : target === "organization"
                      ? "Permanently delete organization"
                      : "Permanently delete my account"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </Layout>
  )
}

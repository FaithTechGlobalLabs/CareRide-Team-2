import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { ArrowRight, Bell, CheckCheck } from "lucide-react"
import { useCare } from "./context"
import { Layout } from "./Layout"
import { ActionButton, Empty, PageTitle, Panel, dateTime } from "./ui"
import { NotificationControls } from "./NotificationControls"

export function NotificationsScreen() {
  const { session, data, mutate } = useCare()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const driver = session?.user.role === "driver"
  const unread = data.notifications.filter((n) => !n.read_at).length
  const notices = data.notifications
    .filter((n) => !unreadOnly || !n.read_at)
    .sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""))
  const firstName = session?.user.name.split(" ")[0] ?? "Your"
  return (
    <Layout driver={driver}>
      <PageTitle
        title={`${firstName}, you’re in the loop.`}
        description={
          driver
            ? "Rides that fit your availability, service area, vehicle, and organization approvals."
            : "Client details, driver assignments, pickups, arrivals, and booking changes in your organization."
        }
      />
      <Panel>
        <NotificationControls />
      </Panel>
      <Panel
        title="Your inbox"
        action={
          unread > 0 ? (
            <ActionButton onClick={() => mutate("/notifications/read-all")}>
              <CheckCheck size={16} /> Mark all as read
            </ActionButton>
          ) : undefined
        }
      >
        <div className="button-row notification-filters">
          <button
            className={`btn ${!unreadOnly ? "primary" : "secondary"}`}
            aria-pressed={!unreadOnly}
            onClick={() => setUnreadOnly(false)}
          >
            All updates
          </button>
          <button
            className={`btn ${unreadOnly ? "primary" : "secondary"}`}
            aria-pressed={unreadOnly}
            onClick={() => setUnreadOnly(true)}
          >
            Unread{unread > 0 ? ` (${unread})` : ""}
          </button>
        </div>
        <div className="notice-list">
          {notices.map((n) => {
            const clientId = n.action_url?.startsWith("/clients/")
              ? n.action_url.slice("/clients/".length)
              : undefined
            const noLongerAvailable =
              driver &&
              n.type === "available_ride" &&
              !data.availableRides.some((r) => r.id === n.ride_request_id)
            const title =
              n.title ??
              {
                confirmation: "Ride request confirmed",
                driver_assigned: "A driver has accepted the ride",
                completed: "Your client has arrived",
                cancelled: "Ride cancelled",
              }[n.type] ??
              "Ride update"
            return (
              <article
                key={n.id}
                className={`notice ${n.read_at ? "" : "unread"}`}
              >
                <Bell size={20} aria-hidden="true" />
                <div className="notice-content">
                  <h3>
                    {title}
                    {!n.read_at && <small className="unread-label">New</small>}
                  </h3>
                  {n.message && <p>{n.message}</p>}
                  <p>
                    {n.sent_at ? dateTime(n.sent_at) : "New update"}
                    {noLongerAvailable ? " · No longer available" : ""}
                  </p>
                  {clientId ? (
                    <Link
                      to="/clients/$clientId"
                      params={{ clientId }}
                      className="text-link"
                    >
                      View client <ArrowRight size={15} />
                    </Link>
                  ) : noLongerAvailable ? (
                    <Link to="/driver" className="text-link">
                      Find available rides <ArrowRight size={15} />
                    </Link>
                  ) : n.ride_request_id ? (
                    <Link
                      to="/rides/$rideId"
                      params={{ rideId: n.ride_request_id }}
                      className="text-link"
                    >
                      {driver ? "View ride" : "View booking"}{" "}
                      <ArrowRight size={15} />
                    </Link>
                  ) : null}
                </div>
                {!n.read_at && (
                  <ActionButton
                    onClick={() => mutate(`/notifications/${n.id}/read`)}
                  >
                    Mark as read
                  </ActionButton>
                )}
              </article>
            )
          })}
        </div>
        {!notices.length && (
          <Empty
            title={
              unreadOnly ? "You’re all caught up." : "A little quiet for now."
            }
            description={
              driver
                ? "Eligible rides will appear here when organizations need your help. Keep your availability and approvals up to date."
                : "Updates appear here as your team updates clients and their journeys move forward."
            }
          />
        )}
      </Panel>
    </Layout>
  )
}

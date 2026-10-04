import { Link } from "@tanstack/react-router"
import { ArrowRight, Check, Clock3, MapPin, Phone, Users } from "lucide-react"
import { ConfettiButton } from "../../components/ui/confetti"
import { useCare } from "./context"
import { Layout } from "./Layout"
import {
  ActionButton,
  Badge,
  Empty,
  PageTitle,
  Panel,
  ReasonAction,
  dateTime,
} from "./ui"
export function RideDetail({ rideId }: { rideId: string }) {
  const { data, session, mutate } = useCare()
  const driver = session?.user.role === "driver"
  const ride = [...data.rides, ...data.availableRides].find(
    (r) => r.id === rideId
  )
  if (!ride)
    return (
      <Layout driver={driver}>
        <Empty
          title="Ride unavailable"
          description="The ride may have changed or is no longer eligible. Return to your dashboard and refresh."
          action={
            <Link to={driver ? "/driver" : "/"} className="btn secondary">
              Back to dashboard
            </Link>
          }
        />
      </Layout>
    )
  const client =
    ride.client ?? data.clients.find((c) => c.id === ride.client_id)
  const assigned = ride.driver_id === session?.user.id
  const steps = [
    { title: "Request submitted", done: true, time: ride.created_at },
    {
      title: "Driver assigned",
      done: !!ride.driver_id,
      time: ride.accepted_at,
    },
    {
      title: "Picked up",
      done: !!ride.picked_up_at || ride.status === "completed",
      time: ride.picked_up_at,
    },
    {
      title: "Arrived at destination",
      done: ride.status === "completed",
      time: ride.completed_at,
    },
  ]
  return (
    <Layout driver={driver}>
      <Link to={driver ? "/driver" : "/rides"} className="text-link">
        ← Back to rides
      </Link>
      <PageTitle
        title={client ? `${client.first_name}’s journey` : "A journey to care."}
        description={
          <span>
            Scheduled pickup:{" "}
            <strong>{dateTime(ride.requested_pickup_at)} </strong>· America/Vancouver
          </span>
        }
        action={<Badge status={ride.status} />}
      />
      <div className="booking-columns">
        <div>
          <Panel
            title="The journey"
            action={<span className="free-tag">Free ride</span>}
          >
            <div className="detail-route">
              <div>
                <span className="route-point" />
                <small>PICKUP</small>
                <h3>{ride.pickup_address}</h3>
              </div>
              <div>
                <MapPin size={20} />
                <small>DESTINATION</small>
                <h3>{ride.destination_address}</h3>
              </div>
            </div>
            <div className="detail-grid">
              <div>
                <small>Primary client</small>
                <strong>
                  {client
                    ? `${client.first_name} ${client.last_name}`
                    : "Passenger information at assignment"}
                </strong>
              </div>
              <div>
                <small>Passengers</small>
                <strong>
                  <Users size={16} />
                  {ride.passenger_count}
                </strong>
              </div>
              <div>
                <small>Accessibility</small>
                <strong>{ride.accessibility_needs || "None requested"}</strong>
              </div>
            </div>
            {(ride.notes || client?.notes) && (
              <div className="info-box">
                {ride.notes}
                {client?.notes && <p>Client accommodations: {client.notes}</p>}
              </div>
            )}
            {ride.linked_ride_id && (
              <Link
                className="text-link"
                to="/rides/$rideId"
                params={{ rideId: ride.linked_ride_id }}
              >
                View linked {ride.trip_leg === "return" ? "outbound" : "return"}{" "}
                ride <ArrowRight size={15} />
              </Link>
            )}
            {driver && (
              <a
                className="btn secondary"
                href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${ride.pickup_lat}%2C${ride.pickup_lng}%3B${ride.destination_lat}%2C${ride.destination_lng}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={17} />
                Open directions
              </a>
            )}
          </Panel>
          <Panel title={driver ? "Ride actions" : "Booking details"}>
            {driver ? (
              <>
                <div className="action-row">
                  {!ride.driver_id && ride.status === "requested" && (
                    // <ActionButton
                    //   className="primary"
                    //   onClick={() => mutate(`/rides/${ride.id}/accept`)}
                    // >
                    //   Accept this ride <ArrowRight size={17} />
                    // </ActionButton>
                    <ConfettiButton onClick={() => mutate(`/rides/${ride.id}/accept`)} className = "btn secondary">Accept this ride</ConfettiButton>
                  )}
                  {assigned && ride.status === "accepted" && (
                    <ActionButton
                      className="primary"
                      onClick={() => mutate(`/rides/${ride.id}/pickup`)}
                    >
                      Mark picked up
                    </ActionButton>
                  )}
                  {assigned && ride.status === "in_progress" && (
                    <ActionButton
                      className="primary"
                      onClick={() => mutate(`/rides/${ride.id}/dropoff`)}
                    >
                      Mark dropped off <Check size={18} />
                    </ActionButton>
                  )}
                  {assigned && ride.status === "accepted" && (
                    <>
                      <ReasonAction
                        title="Client no-show"
                        onSubmit={(reason) =>
                          mutate(`/rides/${ride.id}/no-show`, "POST", {
                            reason,
                          })
                        }
                      />
                      <ReasonAction
                        title="Withdraw from ride"
                        onSubmit={(reason) =>
                          mutate(`/rides/${ride.id}/withdraw`, "POST", {
                            reason,
                          })
                        }
                      />
                    </>
                  )}
                </div>
                {["completed", "cancelled", "no_show"].includes(
                  ride.status
                ) && <p className="muted">This journey is closed.</p>}
              </>
            ) : (
              <>
                <p className="muted">
                  {ride.status === "requested"
                    ? "Your request is waiting for an eligible driver. Booking editing is planned for the next integration pass."
                    : "This screen shows the booking snapshot saved when the ride was requested."}
                </p>
                {["requested", "accepted"].includes(ride.status) && (
                  <ReasonAction
                    title="Cancel booking"
                    onSubmit={(reason) =>
                      mutate(`/rides/${ride.id}/cancel`, "POST", { reason })
                    }
                  />
                )}
              </>
            )}
            {ride.cancelled_reason && (
              <p>Cancellation reason: {ride.cancelled_reason}</p>
            )}
          </Panel>
        </div>
        <div>
          <Panel title="Ride progress">
            <ol className="timeline">
              {steps.map((s, i) => (
                <li key={s.title} className={s.done ? "done" : ""}>
                  <span>{s.done ? <Check size={15} /> : i + 1}</span>
                  <div>
                    <strong>{s.title}</strong>
                    <small>
                      {s.time
                        ? dateTime(s.time)
                        : s.done
                          ? "Confirmed"
                          : "Up next"}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
            {["cancelled", "no_show"].includes(ride.status) && (
              <Badge status={ride.status} />
            )}
          </Panel>
          <Panel title="Your driver">
            {ride.driver ? (
              <>
                <h3>{ride.driver.name}</h3>
                <p>
                  {ride.driver.vehicle
                    ? `${ride.driver.vehicle.make} ${ride.driver.vehicle.model} · ${ride.driver.vehicle.plate}`
                    : "Vehicle details will appear here."}
                </p>
                <a className="text-link" href={`tel:${ride.driver.phone}`}>
                  <Phone size={15} />
                  {ride.driver.phone}
                </a>
              </>
            ) : (
              <Empty
                title="A helping hand is on the way."
                description="Driver details appear once the request is accepted."
              />
            )}
            {ride.waiting_minutes != null && (
              <p className="info-box">
                <Clock3 size={16} />
                Driver waiting policy: {ride.waiting_minutes} minutes after
                scheduled pickup.
              </p>
            )}
            {ride.staff?.phone && (
              <a href={`tel:${ride.staff.phone}`} className="text-link">
                Contact booking staff: {ride.staff.name}
              </a>
            )}
          </Panel>
        </div>
      </div>
    </Layout>
  )
}

import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  Check,
  Clock3,
  HeartHandshake,
  MapPin,
  Plus,
  Users,
} from "lucide-react"
import { useCare } from "./context"
import { Layout } from "./Layout"
import { AddToCalendar } from "./AddToCalendar"
import {
  AddLink,
  Empty,
  PageTitle,
  Panel,
  GroupedRideList,
  RideList,
  RideSearch,
  Success,
} from "./ui"
import { RideSchedule, TodayColumn } from "./WeekCalendar"
import { usePersonalText } from "./personalText"
export function Dashboard() {
  const { data, session } = useCare()
  const copy = usePersonalText(session?.user.name.split(" ")[0] ?? "there")
  const pendingApprovals = data.verifications.filter(
    (v) => v.status === "pending"
  ).length
  const upcoming = data.rides
    .filter((r) => ["requested", "accepted", "in_progress"].includes(r.status))
    .sort((a, b) => a.requested_pickup_at.localeCompare(b.requested_pickup_at))
  const awaiting = upcoming.filter((r) => r.status === "requested")
  const assigned = upcoming.filter((r) => r.status !== "requested")
  const completed = data.rides.filter((r) => r.status === "completed")
  const unread = data.notifications.filter((n) => !n.read_at).length
  return (
    <Layout>
      <PageTitle
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        action={<AddLink to="/book">Book a ride</AddLink>}
      />
      <div className="stats-grid">
        <Stat
          icon={<Clock3 size={21} />}
          title="Awaiting a driver"
          value={awaiting.length}
          note="Ready for a volunteer"
          tone="amber"
        />
        <Stat
          icon={<CarFront size={21} />}
          title="Drivers assigned"
          value={assigned.length}
          note="In good hands"
        />
        <Stat
          icon={<Check size={21} />}
          title="Completed rides"
          value={completed.length}
          note="Connections made"
          className="completed-rides-stat"
        />
      </div>
      <div className="dashboard-columns">
        <div>
          <Panel
            title="Upcoming rides"
            description="Keep an eye on the journeys you’ve arranged."
            action={
              <Link to="/rides" className="text-link">
                View all <ArrowRight size={15} />
              </Link>
            }
          >
            {upcoming.length ? (
              <GroupedRideList rides={upcoming} />
            ) : (
              <Empty
                title="A clear road ahead"
                description="Book a ride to help a client get where they need to go."
                action={<AddLink to="/book">Book a ride</AddLink>}
              />
            )}
          </Panel>
          <Panel
            title="Your community impact"
            description="Every completed journey is a connection to care."
            className="impact-panel"
          >
            <div className="impact-inner">
              <span className="impact-icon">
                <HeartHandshake size={39} />
              </span>
              <div>
                <span className="sample-tag">
                  Sample savings · illustrative data
                </span>
                <h3>Small journeys. Real possibilities.</h3>
                <p>
                  Savings below are made up for the demo, not measured outcomes.
                </p>
              </div>
            </div>
            <div className="impact-metrics">
              <div>
                <strong>{completed.length}</strong>
                <span>Completed rides</span>
              </div>
              <div>
                <strong>${data.summary.estimated_cost_saved ?? 0}</strong>
                <span>Sample transportation savings</span>
              </div>
              <div>
                <strong>
                  {data.summary.staff_minutes_saved ??
                    data.summary.minutes_saved ??
                    0}{" "}
                  min
                </strong>
                <span>Sample staff time saved</span>
              </div>
            </div>
          </Panel>
        </div>
        <div>
          <Panel title="Quick actions">
            <div className="quick-actions">
              <Link to="/book" search={{ client: undefined }}>
                <span className="quick-icon">
                  <Plus size={20} />
                </span>
                <div>
                  <strong>Book a ride</strong>
                  <small>Help a client get to care</small>
                </div>
                <ArrowRight size={17} />
              </Link>
              <Link to="/clients/new">
                <span className="quick-icon">
                  <Users size={20} />
                </span>
                <div>
                  <strong>Register a client</strong>
                  <small>A warm welcome starts here</small>
                </div>
                <ArrowRight size={17} />
              </Link>
              <Link to="/locations/new">
                <span className="quick-icon">
                  <MapPin size={20} />
                </span>
                <div>
                  <strong>Add an Address</strong>
                  <small>Save a destination for your community</small>
                </div>
                <ArrowRight size={17} />
              </Link>
            </div>
          </Panel>
          <Panel title="A helping hand" className="help-panel">
            <span className="help-illustration">
              <HeartHandshake size={46} strokeWidth={1.3} />
            </span>
            <h3>
              Care goes further
              <br />
              when we go together.
            </h3>
            <p>
              {pendingApprovals
                ? `${pendingApprovals} driver approval${pendingApprovals === 1 ? " is" : "s are"} waiting. Welcome another helping hand into your community.`
                : "You’re up to date on driver approvals. Thank you for keeping your community connected to care."}
            </p>
            <Link to="/approvals" className="btn secondary">
              {pendingApprovals ? "Review approvals" : "View approvals"}{" "}
              <ArrowRight size={15} />
            </Link>
          </Panel>
          <Panel title="Stay in the loop">
            <p className="muted">
              {unread
                ? `${unread} unread ride update${unread > 1 ? "s" : ""}.`
                : "You’re all caught up. New ride updates will appear here."}
            </p>
            <Link to="/notifications" className="text-link">
              Open notifications <ArrowRight size={15} />
            </Link>
          </Panel>
        </div>
      </div>
    </Layout>
  )
}
function Stat({
  icon,
  title,
  value,
  note,
  tone = "",
  className = "",
}: {
  icon: React.ReactNode
  title: string
  value: number
  note: string
  tone?: string
  className?: string
}) {
  return (
    <Link to="/rides" className={`stat-card ${tone} ${className}`}>
      <div>
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value.toString().padStart(2, "0")}</strong>
      <small>{note}</small>
    </Link>
  )
}
export function RidesScreen() {
  const { data } = useCare()
  return (
    <Layout>
      <PageTitle
        title="Every journey, in one place."
        description="Search bookings and follow each ride from request to arrival."
        action={<AddLink to="/book">Book a ride</AddLink>}
      />
      <Panel
        title="Schedule"
        description="Week and month views of committed and requested rides."
      >
        <RideSchedule rides={data.rides} />
      </Panel>
      <Panel>
        <RideSearch rides={data.rides} />
      </Panel>
    </Layout>
  )
}
export function DriverDashboard() {
  const { data, session } = useCare()
  const [confirmation] = useState(
    () => sessionStorage.getItem("careride-driver-confirmation") ?? ""
  )
  const [acceptedRideId] = useState(
    () => sessionStorage.getItem("careride-driver-accepted-ride") ?? ""
  )
  useEffect(() => {
    if (confirmation) sessionStorage.removeItem("careride-driver-confirmation")
    sessionStorage.removeItem("careride-driver-accepted-ride")
  }, [confirmation])
  const acceptedRide = data.rides.find((ride) => ride.id === acceptedRideId)
  const active = data.rides.filter((r) =>
    ["accepted", "in_progress"].includes(r.status)
  )
  const copy = usePersonalText(
    session?.user.name.split(" ")[0] ?? "driver",
    true
  )
  return (
    <Layout driver>
      <PageTitle
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        action={
          <Link className="btn secondary" to="/driver/availability">
            <CalendarDays size={18} />
            My availability
          </Link>
        }
      />
      {confirmation && (
        <div className="driver-confirmation">
          <Success>{confirmation}</Success>
          {acceptedRide && (
            <AddToCalendar key={acceptedRide.id} ride={acceptedRide} />
          )}
        </div>
      )}
      <div className="my-rides-layout">
        <div>
          <Panel
            title="Ride Requests"
            description="Requests that match your organization approval, vehicle, schedule, and service area."
            action={
              <span className="count-pill">
                {data.availableRides.length} available
              </span>
            }
          >
            {data.availableRides.length ? (
              <RideList rides={data.availableRides} driver />
            ) : (
              <Empty
                title="No matching requests right now"
                description="Check your organization approval and active availability. New matches appear when staff book a ride."
                action={
                  <Link to="/driver/availability" className="btn secondary">
                    Review availability
                  </Link>
                }
              />
            )}
          </Panel>

          <Panel
            title="Your upcoming rides"
            description="The people counting on you for their next journey."
          >
            {active.length ? (
              <GroupedRideList
                rides={active}
                driver
                hideStatuses={["accepted"]}
              />
            ) : (
              <Empty
                title="Your next journey is waiting"
                description="Accept an eligible ride below to help someone get to care."
              />
            )}
          </Panel>
          <Panel title="Past journeys">
            <RideList
              rides={data.rides.filter((r) =>
                ["completed", "no_show", "cancelled"].includes(r.status)
              )}
              driver
            />
          </Panel>
        </div>
        <aside className="today-side">
          <Panel
            title="Today"
            action={
              <Link to="/driver/schedule" className="text-link">
                Schedule
              </Link>
            }
          >
            <TodayColumn rides={data.rides} />
          </Panel>
        </aside>
      </div>
    </Layout>
  )
}

export function DriverScheduleScreen() {
  const { data } = useCare()
  return (
    <Layout driver>
      <PageTitle
        eyebrow="YOUR TIME"
        title="Schedule."
        description="Each block is the drive, plus 15 minutes before and after."
      />
      <Panel>
        <RideSchedule rides={data.rides} driver />
      </Panel>
    </Layout>
  )
}

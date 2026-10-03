import type { ReactNode } from "react"
import { Link, useLocation, useNavigate } from "@tanstack/react-router"
import {
  Bell,
  CalendarDays,
  CarFront,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  MapPin,
  Plus,
  Users,
} from "lucide-react"
import { useCare } from "./context"
import { Brand, ErrorBox } from "./ui"
import { IS_DEMO } from "./api"

export function Layout({
  children,
  driver = false,
}: {
  children: ReactNode
  driver?: boolean
}) {
  const { session, logout, data, error, refresh, loading } = useCare()
  const path = useLocation({ select: (s) => s.pathname })
  const navigate = useNavigate()
  if (!session)
    return (
      <main className="access-page">
        <Brand />
        <h1>Your community, connected.</h1>
        <p>Log in to arrange or volunteer for a ride.</p>
        <Link to="/login" className="btn primary">
          Go to login
        </Link>
      </main>
    )
  if ((session.user.role === "driver") !== driver)
    return (
      <main className="access-page">
        <Brand />
        <h1>This page is for {driver ? "drivers" : "organization staff"}.</h1>
        <Link
          to={session.user.role === "driver" ? "/driver" : "/"}
          className="btn primary"
        >
          Back to my dashboard
        </Link>
      </main>
    )
  const nav = driver
    ? [
        { to: "/driver", title: "My rides", icon: CarFront },
        {
          to: "/driver/availability",
          title: "Availability",
          icon: CalendarDays,
        },
        {
          to: "/driver/verification",
          title: "Organization approvals",
          icon: ClipboardCheck,
        },
      ]
    : [
        { to: "/", title: "Overview", icon: LayoutDashboard },
        { to: "/rides", title: "All rides", icon: CarFront },
        { to: "/clients", title: "Clients", icon: Users },
        { to: "/locations", title: "Address book", icon: MapPin },
        { to: "/approvals", title: "Driver approvals", icon: ClipboardCheck },
        { to: "/notifications", title: "Notifications", icon: Bell },
      ]
  const unread = data.notifications.filter((n) => !n.read_at).length
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link to={driver ? "/driver" : "/"}>
          <Brand />
        </Link>
        <div className="workspace">
          <span className="workspace-mark">
            {driver ? <CarFront size={21} /> : "B"}
          </span>
          <div>
            <strong>
              {driver
                ? "Volunteer workspace"
                : (session.organization?.name ??
                  session.user.organization_name ??
                  "Your organization")}
            </strong>
            <small>
              {driver
                ? "Every ride makes a difference"
                : "Partner organization"}
            </small>
          </div>
          <ChevronDown size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ to, title, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`nav-link ${(to === "/" ? path === "/" : path === to || path.startsWith(`${to}/`)) ? "active" : ""}`}
            >
              <Icon size={19} />
              <span>{title}</span>
              {to === "/notifications" && unread > 0 && (
                <span className="nav-count">{unread}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="community-note">
            <HeartHandshake size={26} />
            <strong>
              A little help.
              <br />A way forward.
            </strong>
            <p>Connecting people to the care they need.</p>
          </div>
          <button
            className="nav-link"
            onClick={() => {
              logout()
              void navigate({ to: "/login" })
            }}
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Your workspace <span>/</span>{" "}
            <strong>
              {nav.find((n) => n.to === path)?.title ?? "Ride coordination"}
            </strong>
          </div>
          <div className="topbar-actions">
            {IS_DEMO && <span className="demo-pill">Screen demo</span>}
            <button
              className="icon-button refresh-button"
              title="Refresh data"
              aria-label="Refresh data"
              onClick={() => {
                void refresh()
              }}
            >
              <span className={loading ? "spinning" : ""}>↻</span>
            </button>
            {!driver && (
              <Link
                to="/notifications"
                className="icon-button notification-button"
                aria-label={`Notifications, ${unread} unread`}
              >
                <Bell size={19} />
                {unread > 0 && <i />}
              </Link>
            )}
            <div className="user-avatar">
              {session.user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="user-info">
              <strong>{session.user.name}</strong>
              <small>
                {driver ? "Volunteer driver" : "Organization admin"}
              </small>
            </div>
          </div>
        </header>
        {IS_DEMO && (
          <div className="demo-banner">
            Demo workspace · Sample data is saved in this browser. Use synthetic
            client information.
          </div>
        )}
        <main id="main-content" className="page-content">
          <ErrorBox error={error} />
          {children}
        </main>
        <footer className="app-footer">
          <span>CareRide · A community effort</span>
          <span>
            <CircleHelp size={14} />
            All rides are free of charge
          </span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.slice(0, 4).map(({ to, title, icon: Icon }) => (
          <Link key={to} to={to} className={path === to ? "active" : ""}>
            <Icon size={19} />
            <span>{title}</span>
          </Link>
        ))}
        {!driver && (
          <Link to="/book" search={{ client: undefined }}>
            <Plus size={19} />
            <span>Book a ride</span>
          </Link>
        )}
      </nav>
    </div>
  )
}

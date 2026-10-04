import { useEffect, useState, type ReactNode } from "react"
import { Link, useLocation, useNavigate } from "@tanstack/react-router"
import {
  Bell,
  Calendar,
  CalendarDays,
  CarFront,
  Check,
  CircleHelp,
  ClipboardCheck,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  MapPin,
  Plus,
  Share,
  SquarePlus,
  Users,
  X,
} from "lucide-react"
import { useCare } from "./context"
import { Brand, ErrorBox } from "./ui"
import { IS_DEMO } from "./api"
import { NotificationControls, useDriverReadChanges, useNotificationChoice } from "./NotificationControls"
import { noticesForSession, rememberNewNotices, showNativeNotice } from "./notifications"
import {
  clearPendingInstallHelp,
  hasPendingInstallHelp,
  isAndroidBrowser,
  isIOSSafari,
  isStandaloneWebApp,
} from "./iosInstall"

export function Layout({
  children,
  driver = false,
}: {
  children: ReactNode
  driver?: boolean
}) {
  const { session, logout, data, dataVersion, error } = useCare()
  const { choice, permission } = useNotificationChoice(session?.user.id ?? "")
  useDriverReadChanges()
  const path = useLocation({ select: (s) => s.pathname })
  const navigate = useNavigate()
  const [accountOpenPath, setAccountOpenPath] = useState<string | null>(null)
  const [installHelpOpen, setInstallHelpOpen] = useState(hasPendingInstallHelp)
  const accountOpen = accountOpenPath === path
  const android = isAndroidBrowser()
  const showInstallHelp = (isIOSSafari() || android) && !isStandaloneWebApp()
  useEffect(() => {
    if (installHelpOpen) clearPendingInstallHelp()
  }, [installHelpOpen])
  useEffect(() => {
    if (!session || dataVersion === 0) return
    const fresh = rememberNewNotices(session.user.id, noticesForSession(data, session))
    if (choice === "enabled" && permission === "granted") {
      fresh.forEach((notice) => { void showNativeNotice(notice, session) })
    }
  }, [session, data, dataVersion, choice, permission])
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
        { to: "/driver/schedule", title: "Schedule", icon: Calendar },
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
        { to: "/notifications", title: "Notifications", icon: Bell },
      ]
    : [
        { to: "/", title: "Overview", icon: LayoutDashboard },
        { to: "/rides", title: "All rides", icon: CarFront },
        { to: "/clients", title: "Clients", icon: Users },
        { to: "/locations", title: "Address book", icon: MapPin },
        { to: "/approvals", title: "Driver approvals", icon: ClipboardCheck },
        { to: "/notifications", title: "Notifications", icon: Bell },
      ]
  const unread = noticesForSession(data, session).filter((n) => !n.read_at).length
  const navActive = (to: string) => {
    if (to === "/") return path === "/"
    if (to === "/driver")
      return path === "/driver" || path.startsWith("/rides/")
    return path === to || path.startsWith(`${to}/`)
  }
  const signOut = () => {
    logout()
    void navigate({ to: "/login" })
  }
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
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ to, title, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" || to === "/driver" }}
              className={`nav-link ${navActive(to) ? "active" : ""}`}
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
              A little help,
              <br />A way forward.
            </strong>
            <p>Connecting people to the care they need.</p>
          </div>
          <button className="nav-link" onClick={signOut}>
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <Link
            to={driver ? "/driver" : "/"}
            className="mobile-home-brand"
            aria-label="CareRide home"
          >
            <Brand />
          </Link>
          <div className="breadcrumb">
            Your workspace <span>/</span>{" "}
            <strong>
              {nav.find((n) => n.to === path)?.title ?? "Ride coordination"}
            </strong>
          </div>
          <div className="topbar-actions">
            {IS_DEMO && <span className="demo-pill">Screen demo</span>}
            <Link
              to="/notifications"
              className="icon-button notification-button"
              aria-label={`Notifications, ${unread} unread`}
            >
              <Bell size={19} />
              {unread > 0 && <i />}
            </Link>
            <button
              type="button"
              className="user-avatar"
              aria-label="Account menu"
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              onClick={() => setAccountOpenPath(accountOpen ? null : path)}
            >
              {session.user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </button>
            {accountOpen && (
              <div className="user-menu" role="menu">
                <div>
                  <strong>{session.user.name}</strong>
                  <small>
                    {driver ? "Volunteer driver" : "Organization admin"}
                  </small>
                </div>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={signOut}
                >
                  <LogOut size={16} /> Log out
                </button>
                {showInstallHelp && (
                  <button
                    type="button"
                    className="btn secondary install-menu-button"
                    onClick={() => {
                      setAccountOpenPath(null)
                      setInstallHelpOpen(true)
                    }}
                  >
                    <SquarePlus size={16} /> Add to Home Screen
                  </button>
                )}
              </div>
            )}
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
          <NotificationControls compact />
          {children}
        </main>
        <div className="mobile-community-signoff">
          <HeartHandshake size={28} aria-hidden="true" />
          <strong>A little help, A way forward.</strong>
          <p>Connecting people to the care they need.</p>
        </div>
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
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" || to === "/driver" }}
            className={navActive(to) ? "active" : ""}
          >
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
      {installHelpOpen && (
        <div
          className="install-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setInstallHelpOpen(false)
          }}
        >
          <section
            className="install-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-dialog-title"
          >
            <button
              type="button"
              className="install-dialog-close"
              aria-label="Close install instructions"
              onClick={() => setInstallHelpOpen(false)}
            >
              <X size={20} />
            </button>
            <span className="install-dialog-icon" aria-hidden="true">
              <SquarePlus size={26} />
            </span>
            <p className="eyebrow">
              {android ? "ANDROID WEB APP" : "IPHONE WEB APP"}
            </p>
            <h2 id="install-dialog-title">Add CareRide to your Home Screen!</h2>
            <p className="install-dialog-intro">
              {android
                ? "Android requires this final step from your browser. It only takes a few taps."
                : "Apple requires this final step from Safari. It only takes a few taps."}
            </p>
            <ol className="install-steps">
              {android ? (
                <>
                  <li>
                    <span>1</span>
                    <div>
                      <strong>
                        Tap the three-dot menu in the top-right corner.
                      </strong>
                    </div>
                  </li>
                  <li>
                    <span>2</span>
                    <div>
                      <strong>
                        Tap ‘Install and Create shortcut’ or Install app or Add
                        to Home screen.
                      </strong>
                      <p>The wording depends on your device.</p>
                    </div>
                  </li>
                  <li>
                    <span>3</span>
                    <div>
                      <strong>Tap Install or Add.</strong>
                    </div>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <span>
                      <Share size={20} />
                    </span>
                    <div>
                      <strong>Open Safari's Share menu</strong>
                      <p>
                        Tap the Share icon hiding in the the three dots menu.
                      </p>
                    </div>
                  </li>
                  <li>
                    <span>
                      <SquarePlus size={20} />
                    </span>
                    <div>
                      <strong>Tap Add to Home Screen</strong>
                      <p>Scroll down if you do not see it.</p>
                    </div>
                  </li>
                  <li>
                    <span>
                      <Check size={20} />
                    </span>
                    <div>
                      <strong>Tap Add.</strong>
                      <p>
                        Keep Open as Web App turned on (It is on by default).
                      </p>
                    </div>
                  </li>
                </>
              )}
            </ol>
          </section>
        </div>
      )}
    </div>
  )
}

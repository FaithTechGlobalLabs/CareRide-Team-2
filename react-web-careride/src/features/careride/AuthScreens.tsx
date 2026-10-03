import { useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  ArrowRight,
  CarFront,
  Check,
  HeartHandshake,
  ShieldCheck,
} from "lucide-react"
import { request, IS_DEMO } from "./api"
import { useCare } from "./context"
import { Brand, Field, Form } from "./ui"
import type { Session } from "./types"

const demoAccounts = [
  { name: "Alvin", role: "Staff", email: "alvin.demo@careride.local" },
  { name: "Aretha", role: "Staff", email: "aretha.demo@careride.local" },
  { name: "Billy", role: "Staff", email: "billy.demo@careride.local" },
  { name: "Olive", role: "Driver", email: "olive.demo@careride.local" },
  { name: "Derek", role: "Driver", email: "derek.demo@careride.local" },
  { name: "Kenton", role: "Driver", email: "kenton.demo@careride.local" },
  { name: "Eshean", role: "Driver", email: "eshean.demo@careride.local" },
]

function AuthFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">A COMMUNITY EFFORT</span>
          <h1>
            A little help.
            <br />A way forward.
          </h1>
          <p>Getting to care should never stand in the way of receiving it.</p>
          <div className="journey-art">
            <span>
              <HeartHandshake size={42} />
            </span>
            <i />
            <span>
              <CarFront size={42} />
            </span>
            <i />
            <span>
              <ShieldCheck size={42} />
            </span>
          </div>
          <div className="auth-benefits">
            <p>
              <Check size={17} />
              Free rides to essential services
            </p>
            <p>
              <Check size={17} />
              Drivers approved by your organization
            </p>
            <p>
              <Check size={17} />
              People at the heart of every journey
            </p>
          </div>
        </div>
        <small>CareRide · Connecting our community, one ride at a time.</small>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-card">{children}</div>
        <small className="auth-footnote">
          Built for the people who care for our communities.
        </small>
      </main>
    </div>
  )
}
export function LoginScreen() {
  const { login } = useCare()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [reset, setReset] = useState(false)
  return (
    <AuthFrame>
      <span className="eyebrow">WELCOME TO CARERIDE</span>
      <h1>Welcome back.</h1>
      <p className="auth-description">
        A ride to care starts with you.
        <br />
        Log in to your workspace to get started.
      </p>
      <Form
        submit="Log in"
        onSubmit={async (f) => {
          const session = await request<Session>(
            "/auth/login",
            null,
            "POST",
            Object.fromEntries(f)
          )
          login(session)
          await navigate({
            to: session.user.role === "driver" ? "/driver" : "/",
          })
        }}
      >
        <Field label="Email address" wide>
          <input
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@organization.ca"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password" wide>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <div className="wide forgot-line">
          <button
            type="button"
            className="text-link"
            onClick={() => setReset(!reset)}
          >
            Forgot password?
          </button>
        </div>
        {reset && (
          <p role="status" className="wide info-box">
            Password reset is not available in this demo. Contact your
            organization administrator for help.
          </p>
        )}
      </Form>
      <div className="auth-register">
        <p>New to our community?</p>
        <Link to="/register/organization">
          Register your organization <ArrowRight size={15} />
        </Link>
        <Link to="/register/driver">
          Become a volunteer driver <ArrowRight size={15} />
        </Link>
      </div>
      <div className="demo-login">
        <span className="eyebrow">
          {IS_DEMO ? "TRY THE SCREEN DEMO" : "SYNTHETIC DEMO ACCOUNTS"}
        </span>
        <p>
          {IS_DEMO
            ? "Explore the staff and driver screens with sample data."
            : "Use these accounts if your API was seeded for the demo."}
        </p>
        <div>
          {demoAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              className="btn secondary"
              onClick={() => {
                setEmail(account.email)
                setPassword("CareRideDemo1")
              }}
            >
              {account.name} · {account.role}
            </button>
          ))}
        </div>
      </div>
    </AuthFrame>
  )
}
export function OrganizationRegistration() {
  const { login } = useCare()
  const navigate = useNavigate()
  return (
    <AuthFrame>
      <Link to="/login" className="text-link">
        ← Back to login
      </Link>
      <h1>Bring your community.</h1>
      <p className="auth-description">
        Register your organization and its first administrator.
      </p>
      {IS_DEMO && (
        <p className="info-box">
          Screen demo: registration opens a sample workspace. No real account is
          created.
        </p>
      )}
      <Form
        submit="Register organization"
        onSubmit={async (f) => {
          const session = await request<Session>(
            "/organizations/register",
            null,
            "POST",
            Object.fromEntries(f)
          )
          login(session)
          await navigate({ to: "/" })
        }}
      >
        <Field label="Organization name" wide>
          <input name="name" required />
        </Field>
        <Field label="Organization type" wide>
          <select name="type">
            <option value="partner_org">
              Partner organization — arrange rides
            </option>
            <option value="transport_provider">
              Transport provider — provide rides
            </option>
          </select>
        </Field>
        <Field label="Address" wide>
          <input name="address" required />
        </Field>
        <Field label="Contact name">
          <input name="contact_name" required />
        </Field>
        <Field label="Contact phone">
          <input name="phone" type="tel" required />
        </Field>
        <Field label="Contact email" wide>
          <input name="email" type="email" required />
        </Field>
        <h3 className="wide form-section">First administrator</h3>
        <Field label="Administrator name" wide>
          <input name="admin_name" autoComplete="name" required />
        </Field>
        <Field label="Administrator email" wide>
          <input
            name="admin_email"
            type="email"
            autoComplete="email"
            required
          />
        </Field>
        <Field label="Password" wide hint="At least 8 characters.">
          <input
            name="admin_password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </Field>
      </Form>
    </AuthFrame>
  )
}
export function DriverRegistration() {
  const { login } = useCare()
  const navigate = useNavigate()
  const [affiliated, setAffiliated] = useState(false)
  return (
    <AuthFrame>
      <Link to="/login" className="text-link">
        ← Back to login
      </Link>
      <h1>Make a way forward.</h1>
      <p className="auth-description">
        Join as a volunteer driver. Your organization approval comes next.
      </p>
      {IS_DEMO && (
        <p className="info-box">
          Screen demo: no real driver account is created.
        </p>
      )}
      <Form
        submit="Register as a driver"
        onSubmit={async (f) => {
          const values = Object.fromEntries(f)
          const session = await request<Session>(
            "/drivers/register",
            null,
            "POST",
            {
              ...values,
              vehicle: {
                make: values.make,
                model: values.model,
                plate: values.plate,
                seats: Number(values.seats),
                wheelchair_accessible: f.has("wheelchair_accessible"),
              },
            }
          )
          login(session)
          await navigate({ to: "/driver/verification" })
        }}
      >
        <Field label="Full name" wide>
          <input name="name" required />
        </Field>
        <Field label="Date of birth">
          <input
            name="dob"
            type="date"
            required
            max={new Date().toISOString().slice(0, 10)}
          />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" required />
        </Field>
        <Field label="Email address" wide>
          <input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Password" wide>
          <input
            name="password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
          />
        </Field>
        <Field label="Affiliation" wide>
          <select
            onChange={(e) => setAffiliated(e.target.value === "provider")}
          >
            <option value="independent">Independent volunteer</option>
            <option value="provider">Transportation provider</option>
          </select>
        </Field>
        {affiliated && (
          <Field
            label="Provider organization ID"
            wide
            hint="Ask your provider administrator for the organization ID."
          >
            <input name="organization_id" required />
          </Field>
        )}
        <h3 className="wide form-section">Your vehicle</h3>
        <Field label="Make">
          <input name="make" placeholder="Toyota" required />
        </Field>
        <Field label="Model">
          <input name="model" placeholder="Corolla" required />
        </Field>
        <Field label="License plate">
          <input name="plate" maxLength={8} required />
        </Field>
        <Field label="Passenger seats" hint="Excludes the driver.">
          <input
            name="seats"
            type="number"
            min={1}
            max={30}
            defaultValue={3}
            required
          />
        </Field>
        <label className="checkbox wide">
          <input name="wheelchair_accessible" type="checkbox" />
          Wheelchair accessible vehicle
        </label>
      </Form>
    </AuthFrame>
  )
}

import { createFileRoute } from "@tanstack/react-router"
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  MapPin,
  Navigation2,
  Route as RouteIcon,
} from "lucide-react"
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { LocationSearch, type Location } from "@/components/location-search"

export const Route = createFileRoute("/")({ component: BookingPage })

const clients = [
  "Olivia Bennett",
  "Marcus Chen",
  "Aisha Patel",
  "Daniel Thompson",
  "Sofia Martinez",
]
const locations: Location[] = [
  {
    name: "Vancouver General Hospital",
    address: "899 W 12th Ave, Vancouver, BC V5Z 1M9",
    category: "Hospital",
  },
  {
    name: "UBC Hospital",
    address: "2211 Wesbrook Mall, Vancouver, BC V6T 2B5",
    category: "Hospital",
  },
  {
    name: "St. Paul’s Hospital",
    address: "1081 Burrard St, Vancouver, BC V6Z 1Y6",
    category: "Hospital",
  },
  {
    name: "Broadway–City Hall Station",
    address: "496 W Broadway, Vancouver, BC V5Z 1E9",
    category: "Transit",
  },
  {
    name: "Pacific Central Station",
    address: "1150 Station St, Vancouver, BC V6A 4C7",
    category: "Transit",
  },
  {
    name: "Vancouver Public Library",
    address: "350 W Georgia St, Vancouver, BC V6B 6B1",
    category: "Landmark",
  },
  {
    name: "Richmond Centre",
    address: "6551 No. 3 Rd, Richmond, BC V6Y 2B6",
    category: "Shopping",
  },
  {
    name: "YVR Airport",
    address: "3211 Grant McConachie Way, Richmond, BC V7B 0A4",
    category: "Airport",
  },
]

const inputClass =
  "h-12 w-full rounded-lg border border-[#dce3dd] bg-white px-4 text-sm outline-none transition placeholder:text-[#929e95] focus:border-[#27805c] focus:ring-3 focus:ring-[#27805c]/15"

function BookingPage() {
  const [client, setClient] = useState("")
  const [pickup, setPickup] = useState("")
  const [pickupAddress, setPickupAddress] = useState("")
  const [destination, setDestination] = useState("")
  const [destinationAddress, setDestinationAddress] = useState("")
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="min-h-svh bg-[#f6f7f5] text-[#192b25]">
      <header className="border-b border-[#e5e9e5] bg-white">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3" aria-label="CareRide">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#176448] text-white">
              <Navigation2 className="size-5 rotate-45" strokeWidth={2.4} />
            </div>
            <span className="text-lg font-semibold tracking-[-0.04em]">
              CareRide
            </span>
          </div>
          <div className="hidden items-center gap-2 text-sm text-[#69786f] sm:flex">
            <span className="size-2 rounded-full bg-[#49ae79]" /> Booking
            workspace
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pt-10 pb-16 sm:px-8 sm:pt-14">
        <div className="mb-9">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-[#368363] uppercase">
            <span className="h-px w-6 bg-[#79b698]" /> New ride
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
            Create a booking
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#6d7972] sm:text-base">
            Choose a client and add the pickup and drop-off details.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)] lg:gap-8">
          <form
            onSubmit={handleSubmit}
            className="min-w-0 rounded-2xl border border-[#e5e9e5] bg-white shadow-[0_6px_24px_rgba(31,58,43,0.035)]"
          >
            <div className="border-b border-[#edf0ed] px-6 py-5 sm:px-8">
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e7f3ec] text-sm font-semibold text-[#176448]">
                  1
                </span>
                <div>
                  <h2 className="font-semibold tracking-[-0.02em]">
                    Ride details
                  </h2>
                  <p className="text-sm text-[#77837b]">
                    All fields are required
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-8 px-6 py-7 sm:px-8 sm:py-8">
              <div>
                <label
                  htmlFor="client"
                  className="mb-2 block text-sm font-semibold"
                >
                  Primary client
                </label>
                <div className="relative">
                  <select
                    id="client"
                    required
                    value={client}
                    onChange={(event) => {
                      setClient(event.target.value)
                      setSubmitted(false)
                    }}
                    className={`${inputClass} appearance-none pr-11 invalid:text-[#929e95]`}
                  >
                    <option value="" disabled>
                      Select a client
                    </option>
                    {clients.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-[#65766b]"
                  />
                </div>
              </div>

              <section
                className="border-t border-[#edf0ed] pt-7"
                aria-labelledby="pickup-heading"
              >
                <div className="mb-5 flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-full bg-[#e5f4ed] text-[#208054]">
                    <MapPin className="size-4" />
                  </span>
                  <h3
                    id="pickup-heading"
                    className="font-semibold tracking-[-0.02em]"
                  >
                    Pickup
                  </h3>
                </div>
                <div className="space-y-5">
                  <LocationSearch
                    id="pickup-location"
                    label="Pickup location"
                    locations={locations}
                    value={pickup}
                    onChange={(value) => {
                      setPickup(value)
                      setPickupAddress("")
                      setSubmitted(false)
                    }}
                    onSelect={(place) => {
                      setPickup(place.name)
                      setPickupAddress(place.address)
                      setSubmitted(false)
                    }}
                  />
                  <div>
                    <label
                      htmlFor="pickup-address"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Pickup address
                    </label>
                    <input
                      id="pickup-address"
                      required
                      autoComplete="street-address"
                      value={pickupAddress}
                      onChange={(event) => {
                        setPickupAddress(event.target.value)
                        setSubmitted(false)
                      }}
                      placeholder="Street address will appear here"
                      className={inputClass}
                    />
                    <p className="mt-2 text-xs text-[#7a877e]">
                      You can edit the address after choosing a place.
                    </p>
                  </div>
                </div>
              </section>

              <section
                className="border-t border-[#edf0ed] pt-7"
                aria-labelledby="destination-heading"
              >
                <div className="mb-5 flex items-center gap-2.5">
                  <span className="flex size-7 items-center justify-center rounded-full bg-[#edf0fb] text-[#6472b3]">
                    <MapPin className="size-4" />
                  </span>
                  <h3
                    id="destination-heading"
                    className="font-semibold tracking-[-0.02em]"
                  >
                    Drop-off
                  </h3>
                </div>
                <div className="space-y-5">
                  <LocationSearch
                    id="destination"
                    label="Destination"
                    locations={locations}
                    value={destination}
                    onChange={(value) => {
                      setDestination(value)
                      setDestinationAddress("")
                      setSubmitted(false)
                    }}
                    onSelect={(place) => {
                      setDestination(place.name)
                      setDestinationAddress(place.address)
                      setSubmitted(false)
                    }}
                  />
                  <div>
                    <label
                      htmlFor="destination-address"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Destination address
                    </label>
                    <input
                      id="destination-address"
                      required
                      value={destinationAddress}
                      onChange={(event) => {
                        setDestinationAddress(event.target.value)
                        setSubmitted(false)
                      }}
                      placeholder="Street address will appear here"
                      className={inputClass}
                    />
                    <p className="mt-2 text-xs text-[#7a877e]">
                      You can edit the address after choosing a place.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex flex-col gap-4 rounded-b-2xl border-t border-[#edf0ed] bg-[#fbfcfa] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <p className="text-xs leading-5 text-[#758177]">
                This is a demo booking. No ride will be dispatched.
              </p>
              <Button
                type="submit"
                className="h-11 gap-2 rounded-lg bg-[#176448] px-5 text-sm text-white hover:bg-[#115239]"
              >
                Create booking <ArrowRight className="size-4" />
              </Button>
            </div>
          </form>

          <aside className="rounded-2xl border border-[#e5e9e5] bg-white p-6 shadow-[0_6px_24px_rgba(31,58,43,0.035)] sm:p-7 lg:sticky lg:top-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-[#829087] uppercase">
                  Overview
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em]">
                  Your route
                </h2>
              </div>
              <span className="flex size-9 items-center justify-center rounded-lg bg-[#edf5ef] text-[#176448]">
                <RouteIcon className="size-4" />
              </span>
            </div>
            <div className="relative space-y-6 pl-8 before:absolute before:top-3 before:bottom-7 before:left-[9px] before:w-px before:bg-[#d8e3da]">
              <div className="relative">
                <span className="absolute top-1 -left-8 size-[19px] rounded-full border-[5px] border-[#2d9466] bg-white ring-4 ring-white" />
                <p className="text-xs font-medium text-[#829087]">PICKUP</p>
                <p className="mt-1 text-sm font-medium break-words">
                  {pickup || "Add a pickup location"}
                </p>
                {pickupAddress && (
                  <p className="mt-1 text-xs leading-5 break-words text-[#718077]">
                    {pickupAddress}
                  </p>
                )}
              </div>
              <div className="relative">
                <span className="absolute top-1 -left-8 size-[19px] rounded-full border-[5px] border-[#7682c1] bg-white ring-4 ring-white" />
                <p className="text-xs font-medium text-[#829087]">DROP-OFF</p>
                <p className="mt-1 text-sm font-medium break-words">
                  {destination || "Add a destination"}
                </p>
                {destinationAddress && (
                  <p className="mt-1 text-xs leading-5 break-words text-[#718077]">
                    {destinationAddress}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-7 border-t border-[#edf0ed] pt-5">
              <div className="flex items-center gap-2 text-sm text-[#697970]">
                <Clock3 className="size-4" /> Ready to schedule
              </div>
              <p className="mt-2 text-xs leading-5 text-[#8a968d]">
                Route details appear here as you fill out the form.
              </p>
            </div>
            {submitted && (
              <div
                role="status"
                className="mt-6 flex items-start gap-3 rounded-lg border border-[#bfe4cb] bg-[#eef9f1] p-4 text-sm text-[#176448]"
              >
                <Check className="mt-0.5 size-4 shrink-0" />
                <span>
                  Demo booking created for <strong>{client}</strong>.
                </span>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  )
}

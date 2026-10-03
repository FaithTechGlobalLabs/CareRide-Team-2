import { createFileRoute } from "@tanstack/react-router"
import { LocationScreen } from "@/features/careride/StaffScreens"

export const Route = createFileRoute("/locations/$locationId")({
  component: LocationRoute,
})

function LocationRoute() {
  return <LocationScreen locationId={Route.useParams().locationId} />
}

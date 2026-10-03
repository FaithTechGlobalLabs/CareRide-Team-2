import { createFileRoute } from "@tanstack/react-router"
import { LocationsScreen } from "@/features/careride/StaffScreens"

export const Route = createFileRoute("/locations/")({
  component: LocationsScreen,
})

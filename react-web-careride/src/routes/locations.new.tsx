import { createFileRoute } from "@tanstack/react-router"
import { LocationScreen } from "@/features/careride/StaffScreens"

export const Route = createFileRoute("/locations/new")({
  component: LocationScreen,
})

import { createFileRoute } from "@tanstack/react-router"
import { DriverAvailabilityScreen } from "@/features/careride/DriverScreens"

export const Route = createFileRoute("/driver/availability")({
  component: DriverAvailabilityScreen,
})

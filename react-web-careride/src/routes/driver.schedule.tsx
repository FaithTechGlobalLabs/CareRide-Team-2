import { createFileRoute } from "@tanstack/react-router"
import { DriverScheduleScreen } from "@/features/careride/Dashboard"

export const Route = createFileRoute("/driver/schedule")({
  component: DriverScheduleScreen,
})

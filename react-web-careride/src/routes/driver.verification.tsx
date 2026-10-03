import { createFileRoute } from "@tanstack/react-router"
import { DriverVerificationScreen } from "@/features/careride/DriverScreens"

export const Route = createFileRoute("/driver/verification")({
  component: DriverVerificationScreen,
})

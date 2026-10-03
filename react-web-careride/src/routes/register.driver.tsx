import { createFileRoute } from "@tanstack/react-router"
import { DriverRegistration } from "@/features/careride/AuthScreens"

export const Route = createFileRoute("/register/driver")({
  component: DriverRegistration,
})

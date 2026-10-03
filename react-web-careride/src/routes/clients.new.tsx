import { createFileRoute } from "@tanstack/react-router"
import { ClientScreen } from "@/features/careride/StaffScreens"

export const Route = createFileRoute("/clients/new")({
  component: ClientScreen,
})

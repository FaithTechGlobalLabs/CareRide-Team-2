import { createFileRoute } from "@tanstack/react-router"
import { NotificationsScreen } from "@/features/careride/StaffScreens"

export const Route = createFileRoute("/notifications")({
  component: NotificationsScreen,
})

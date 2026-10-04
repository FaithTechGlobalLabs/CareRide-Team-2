import { createFileRoute } from "@tanstack/react-router"
import { NotificationsScreen } from "@/features/careride/NotificationsScreen"

export const Route = createFileRoute("/notifications")({
  component: NotificationsScreen,
})

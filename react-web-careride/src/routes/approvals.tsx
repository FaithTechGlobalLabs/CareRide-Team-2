import { createFileRoute } from "@tanstack/react-router"
import { ApprovalsScreen } from "@/features/careride/StaffScreens"

export const Route = createFileRoute("/approvals")({
  component: ApprovalsScreen,
})

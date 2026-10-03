import { createFileRoute } from "@tanstack/react-router"
import { OrganizationRegistration } from "@/features/careride/AuthScreens"

export const Route = createFileRoute("/register/organization")({
  component: OrganizationRegistration,
})

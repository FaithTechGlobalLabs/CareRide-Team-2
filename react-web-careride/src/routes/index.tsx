import { createFileRoute } from "@tanstack/react-router"
import { Dashboard } from "@/features/careride/Dashboard"

export const Route = createFileRoute("/")({
  component: RouteComponent,
})

function RouteComponent() {
  return <Dashboard />
}

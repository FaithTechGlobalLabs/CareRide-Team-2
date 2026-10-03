import { createFileRoute } from "@tanstack/react-router"
import { ClientScreen } from "@/features/careride/StaffScreens"

export const Route = createFileRoute("/clients/$clientId")({
  component: ClientRoute,
})

function ClientRoute() {
  return <ClientScreen clientId={Route.useParams().clientId} />
}

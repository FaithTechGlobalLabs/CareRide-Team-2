import { createFileRoute } from "@tanstack/react-router"
import { RideDetail } from "@/features/careride/RideDetail"

export const Route = createFileRoute("/rides/$rideId")({
  component: RideRoute,
})

function RideRoute() {
  return <RideDetail rideId={Route.useParams().rideId} />
}

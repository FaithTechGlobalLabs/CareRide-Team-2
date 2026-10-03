import { createFileRoute } from "@tanstack/react-router"
import { BookingScreen } from "@/features/careride/StaffScreens"

export const Route = createFileRoute("/book")({
  validateSearch: (search: Record<string, unknown>) => ({
    client: typeof search.client === "string" ? search.client : undefined,
  }),
  component: BookRoute,
})

function BookRoute() {
  return <BookingScreen selectedClient={Route.useSearch().client} />
}

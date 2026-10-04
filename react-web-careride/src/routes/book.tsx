import { createFileRoute } from "@tanstack/react-router"
import { BookingScreen } from "@/features/careride/StaffScreens"

export const Route = createFileRoute("/book")({
  validateSearch: (search: Record<string, unknown>) => {
    const result: { client?: string; edit?: string } = {}
    if (typeof search.client === "string") result.client = search.client
    if (typeof search.edit === "string") result.edit = search.edit
    return result
  },
  component: BookRoute,
})

function BookRoute() {
  const search = Route.useSearch()
  return (
    <BookingScreen selectedClient={search.client} editRideId={search.edit} />
  )
}

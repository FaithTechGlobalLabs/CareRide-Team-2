import { createFileRoute } from "@tanstack/react-router"
import { ClientsScreen } from "@/features/careride/StaffScreens"

export const Route = createFileRoute("/clients/")({ component: ClientsScreen })

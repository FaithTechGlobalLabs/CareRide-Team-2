import { createFileRoute } from "@tanstack/react-router"
import { DriverDashboard } from "@/features/careride/Dashboard"

export const Route = createFileRoute("/driver/")({ component: DriverDashboard })

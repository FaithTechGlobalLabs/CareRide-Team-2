import { createFileRoute } from "@tanstack/react-router"
import { RidesScreen } from "@/features/careride/Dashboard"

export const Route = createFileRoute("/rides/")({ component: RidesScreen })

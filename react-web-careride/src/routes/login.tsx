import { createFileRoute } from "@tanstack/react-router"
import { LoginScreen } from "@/features/careride/AuthScreens"

export const Route = createFileRoute("/login")({ component: LoginScreen })

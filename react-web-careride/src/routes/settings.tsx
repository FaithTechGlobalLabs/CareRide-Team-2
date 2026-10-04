import { createFileRoute } from "@tanstack/react-router"
import { SettingsScreen } from "@/features/careride/SettingsScreen"
export const Route = createFileRoute("/settings")({ component: SettingsScreen })

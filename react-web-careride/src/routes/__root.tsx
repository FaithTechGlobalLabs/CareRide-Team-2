import { Outlet, createRootRoute } from "@tanstack/react-router"
import { CareProvider } from "@/features/careride/Provider"

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <CareProvider>
      <Outlet />
    </CareProvider>
  )
}

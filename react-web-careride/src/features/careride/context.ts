import { createContext, useContext } from "react"
import type { Data, Session } from "./types"
export interface CareContext {
  session: Session | null
  data: Data
  loading: boolean
  error: string
  refresh: () => Promise<void>
  login: (session: Session) => void
  logout: () => void
  mutate: <T>(path: string, method?: string, body?: unknown) => Promise<T>
}
export const Context = createContext<CareContext | null>(null)
export function useCare() {
  const context = useContext(Context)
  if (!context) throw new Error("CareRide provider missing")
  return context
}
export const emptyData: Data = {
  clients: [],
  destinations: [],
  rides: [],
  availableRides: [],
  verifications: [],
  availability: [],
  notifications: [],
  organizations: [],
  summary: {
    completed_rides: 0,
    estimated_cost_saved: 0,
    staff_minutes_saved: 0,
  },
}

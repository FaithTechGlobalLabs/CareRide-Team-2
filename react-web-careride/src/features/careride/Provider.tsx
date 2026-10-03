import { useCallback, useEffect, useState } from "react"
import type { ReactNode } from "react"
import { Context, emptyData } from "./context"
import { request, IS_DEMO } from "./api"
import type { Data, Session } from "./types"
const KEY = "careride-session"
export function CareProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) ?? "null")
    } catch {
      return null
    }
  })
  const [data, setData] = useState<Data>(emptyData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const refresh = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const driver = session.user.role === "driver"
      const paths = driver
        ? [
            "/drivers/me/rides",
            "/drivers/me/rides/available",
            "/drivers/me/availability",
            "/drivers/me/verifications",
            "/organizations",
          ]
        : [
            "/clients",
            "/destinations",
            "/rides",
            "/notifications",
            "/admin/verifications",
            "/admin/demo-summary",
          ]
      const keys: (keyof Data)[] = driver
        ? [
            "rides",
            "availableRides",
            "availability",
            "verifications",
            "organizations",
          ]
        : [
            "clients",
            "destinations",
            "rides",
            "notifications",
            "verifications",
            "summary",
          ]
      const results = await Promise.allSettled(
        paths.map((path) => request(path, session))
      )
      const next = { ...emptyData }
      const failures: string[] = []
      results.forEach((r, i) => {
        if (r.status === "fulfilled")
          Object.assign(next, { [keys[i]]: r.value })
        else
          failures.push(
            r.reason instanceof Error
              ? r.reason.message
              : "Could not load data."
          )
      })
      setData(next)
      setError(failures.length ? failures.join(" ") : "")
    } finally {
      setLoading(false)
    }
  }, [session])
  useEffect(() => {
    const timer = setTimeout(() => {
      void refresh()
    }, 0)
    const interval = setInterval(
      () => {
        void refresh()
      },
      IS_DEMO ? 10000 : 15000
    )
    const update = () => {
      void refresh()
    }
    window.addEventListener("storage", update)
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
      window.removeEventListener("storage", update)
    }
  }, [refresh])
  function login(value: Session) {
    sessionStorage.setItem(KEY, JSON.stringify(value))
    setData(emptyData)
    setSession(value)
  }
  function logout() {
    sessionStorage.removeItem(KEY)
    setSession(null)
    setData(emptyData)
    setError("")
  }
  async function mutate<T>(path: string, method = "POST", body?: unknown) {
    const result = await request<T>(path, session, method, body)
    await refresh()
    return result
  }
  return (
    <Context.Provider
      value={{ session, data, loading, error, refresh, login, logout, mutate }}
    >
      {children}
    </Context.Provider>
  )
}

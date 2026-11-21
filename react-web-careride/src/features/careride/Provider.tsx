import type { ReactNode } from "react";

import { useLocation } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Data, Session } from "./types";

import { ApiError, request, IS_DEMO } from "./api";
import { Context, emptyData } from "./context";
import { disableDevice } from "./NotificationControls";
const KEY = "careride-session";
export function CareProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    } catch {
      return null;
    }
  });
  const [data, setData] = useState<Data>(emptyData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refreshVersion = useRef(0);
  const onDriverList = useLocation({
    select: (location) =>
      location.pathname === "/driver" || location.pathname === "/driver/",
  });
  const previousDriverList = useRef(onDriverList);
  const refresh = useCallback(async () => {
    if (!session) return;
    const version = ++refreshVersion.current;
    setLoading(true);
    try {
      const driver = session.user.role === "driver";
      const paths = driver
        ? [
            "/drivers/me/rides",
            "/drivers/me/rides/available",
            "/drivers/me/availability",
            "/drivers/me/verifications",
            "/organizations",
            "/notifications",
          ]
        : [
            "/clients",
            "/destinations",
            "/rides",
            "/notifications",
            "/admin/verifications",
            "/admin/demo-summary",
          ];
      const keys: (keyof Data)[] = driver
        ? [
            "rides",
            "availableRides",
            "availability",
            "verifications",
            "organizations",
            "notifications",
          ]
        : [
            "clients",
            "destinations",
            "rides",
            "notifications",
            "verifications",
            "summary",
          ];
      const results = await Promise.allSettled(
        paths.map((path) => request(path, session))
      );
      const next = { ...emptyData };
      const failures: string[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled")
          Object.assign(next, { [keys[i]]: r.value });
        else
          failures.push(
            r.reason instanceof Error
              ? r.reason.message
              : "Could not load data."
          );
      });
      if (version === refreshVersion.current) {
        setData(next);
        setError(failures.length ? failures.join(" ") : "");
      }
    } finally {
      if (version === refreshVersion.current) setLoading(false);
    }
  }, [session]);
  useEffect(() => {
    let timer = setTimeout(() => {
      void refresh();
    }, 0);
    const interval = setInterval(
      () => {
        void refresh();
      },
      IS_DEMO ? 10000 : 15000
    );
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void refresh();
      }, 0);
    };
    const foreground = () => {
      if (
        session?.user.role === "driver" &&
        document.visibilityState === "visible"
      )
        update();
    };
    window.addEventListener("storage", update);
    window.addEventListener("focus", foreground);
    document.addEventListener("visibilitychange", foreground);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener("storage", update);
      window.removeEventListener("focus", foreground);
      document.removeEventListener("visibilitychange", foreground);
    };
  }, [refresh, session?.user.role]);
  useEffect(() => {
    const entered = onDriverList && !previousDriverList.current;
    previousDriverList.current = onDriverList;
    if (entered) void refresh();
  }, [onDriverList, refresh]);
  function login(value: Session) {
    refreshVersion.current++;
    sessionStorage.setItem(KEY, JSON.stringify(value));
    setData(emptyData);
    setSession(value);
  }
  async function logout() {
    refreshVersion.current++;
    if (session && !IS_DEMO) await disableDevice(session).catch(() => {});
    sessionStorage.removeItem(KEY);
    refreshVersion.current++;
    setLoading(false);
    setSession(null);
    setData(emptyData);
    setError("");
  }
  async function mutate<T>(path: string, method = "POST", body?: unknown) {
    try {
      const result = await request<T>(path, session, method, body);
      await refresh();
      return result;
    } catch (caught) {
      if (
        session?.user.role === "driver" &&
        /^\/rides\/[^/]+\/accept$/.test(path)
      ) {
        await refresh();
        setError(
          caught instanceof ApiError && caught.status === 409
            ? `This ride is no longer open. ${caught.message}`
            : caught instanceof Error
              ? caught.message
              : "Unable to accept this ride."
        );
      }
      throw caught;
    }
  }
  return (
    <Context.Provider
      value={{ session, data, loading, error, refresh, login, logout, mutate }}
    >
      {children}
    </Context.Provider>
  );
}

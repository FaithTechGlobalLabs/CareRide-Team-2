export function isIOSSafari() {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  const isSafari =
    /Version\/[\d.]+.*Safari\//.test(navigator.userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA/.test(navigator.userAgent)
  return isIOS && isSafari
}

export function isStandaloneWebApp() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    iosNavigator.standalone === true
  )
}

const FIRST_RIDE_INSTALL_HANDLED = "careride-first-ride-install-handled"
const FIRST_RIDE_INSTALL_PENDING = "careride-first-ride-install-pending"

export function queueInstallHelpAfterFirstRideAcceptance(driverId: string) {
  try {
    const handledKey = `${FIRST_RIDE_INSTALL_HANDLED}:${driverId}`
    if (localStorage.getItem(handledKey)) return
    localStorage.setItem(handledKey, "true")
    if (
      isIOSSafari() &&
      !isStandaloneWebApp() &&
      window.matchMedia("(max-width: 760px)").matches
    ) {
      sessionStorage.setItem(FIRST_RIDE_INSTALL_PENDING, "true")
    }
  } catch {
    // Storage restrictions should never interrupt accepting a ride.
  }
}

export function hasPendingInstallHelp() {
  try {
    return sessionStorage.getItem(FIRST_RIDE_INSTALL_PENDING) === "true"
  } catch {
    return false
  }
}

export function clearPendingInstallHelp() {
  try {
    sessionStorage.removeItem(FIRST_RIDE_INSTALL_PENDING)
  } catch {
    // The prompt is already visible, so restricted storage needs no fallback.
  }
}

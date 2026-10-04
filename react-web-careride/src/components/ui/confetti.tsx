import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"

import { Button } from "@/components/ui/button"

type ConfettiOptions = {
  particleCount?: number
  colors?: string[]
}

type ConfettiOrigin = HTMLElement | { x: number; y: number }

export type ConfettiRef = {
  fire: (options?: ConfettiOptions) => void
}

type ConfettiProps = React.HTMLAttributes<HTMLDivElement> & {
  options?: ConfettiOptions
  manualstart?: boolean
}

const DEFAULT_COLORS = ["#285d4d", "#d99a52", "#8eb8a7", "#f1c27d"]

export function fireConfetti(
  origin?: ConfettiOrigin | null,
  options: ConfettiOptions = {}
) {
  if (
    typeof document === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return

  const rect =
    origin instanceof HTMLElement ? origin.getBoundingClientRect() : null
  const point = origin && !(origin instanceof HTMLElement) ? origin : undefined
  const x = rect
    ? rect.left + rect.width / 2
    : (point?.x ?? window.innerWidth / 2)
  const y = rect
    ? rect.top + rect.height / 2
    : (point?.y ?? window.innerHeight / 2)
  const count = Math.min(Math.max(options.particleCount ?? 28, 12), 48)
  const colors = options.colors?.length ? options.colors : DEFAULT_COLORS
  const burst = document.createElement("span")
  burst.className = "confetti-burst confetti-burst-global"
  burst.setAttribute("aria-hidden", "true")
  burst.style.left = `${x}px`
  burst.style.top = `${y}px`

  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement("i")
    const angle = (index / count) * Math.PI * 2
    const distance = 70 + (index % 6) * 13
    particle.style.setProperty(
      "--confetti-x",
      `${Math.cos(angle) * distance}px`
    )
    particle.style.setProperty(
      "--confetti-y",
      `${Math.sin(angle) * distance}px`
    )
    particle.style.setProperty("--confetti-rotation", `${index * 67}deg`)
    particle.style.setProperty("--confetti-delay", `${(index % 5) * 18}ms`)
    particle.style.backgroundColor = colors[index % colors.length]
    burst.append(particle)
  }

  document.body.append(burst)
  window.setTimeout(() => burst.remove(), 1100)
}

export const Confetti = forwardRef<ConfettiRef, ConfettiProps>(
  (
    { options, manualstart = false, children, className = "", ...props },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null)

    useImperativeHandle(
      ref,
      () => ({
        fire: (nextOptions) =>
          fireConfetti(containerRef.current, { ...options, ...nextOptions }),
      }),
      [options]
    )

    useEffect(() => {
      if (!manualstart) fireConfetti(containerRef.current, options)
    }, [manualstart, options])

    return (
      <div
        ref={containerRef}
        className={`confetti-container ${className}`}
        {...props}
      >
        {children}
      </div>
    )
  }
)
Confetti.displayName = "Confetti"

export interface ConfettiButtonProps extends Omit<
  React.ComponentPropsWithoutRef<typeof Button>,
  "onClick"
> {
  options?: ConfettiOptions
  bursts?: number
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>
}

export const ConfettiButton = forwardRef<
  HTMLButtonElement,
  ConfettiButtonProps
>(({ options, bursts = 1, children, onClick, disabled, ...props }, ref) => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  return (
    <span className="confetti-button-field">
      <Button
        ref={ref}
        type="button"
        disabled={disabled || busy}
        onClick={async (event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          const origin = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          }
          setBusy(true)
          setError("")
          try {
            await onClick?.(event)
            if (!event.defaultPrevented) {
              fireConfetti(origin, options)
              for (let burst = 1; burst < bursts; burst++) {
                window.setTimeout(
                  () => fireConfetti(origin, options),
                  burst * 320
                )
              }
            }
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Unable to complete action."
            )
          } finally {
            setBusy(false)
          }
        }}
        {...props}
      >
        {busy ? "Please wait…" : children}
      </Button>
      {error && (
        <span className="error-box" role="alert">
          {error}
        </span>
      )}
    </span>
  )
})
ConfettiButton.displayName = "ConfettiButton"

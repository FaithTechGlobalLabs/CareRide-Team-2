import { useState } from "react"
import { MapPin, Minus, Plus } from "lucide-react"
const SIZE = 256
function project(lat: number, lng: number, zoom: number) {
  const scale = SIZE * 2 ** zoom
  const sin = Math.sin((lat * Math.PI) / 180)
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  }
}
function unproject(x: number, y: number, zoom: number) {
  const scale = SIZE * 2 ** zoom
  return {
    lat:
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI,
    lng: (x / scale) * 360 - 180,
  }
}
export function PinMap({
  lat,
  lng,
  onChange,
  radius,
}: {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
  radius?: number
}) {
  const [zoom, setZoom] = useState(radius ? 10 : 13)
  const [centre, setCentre] = useState({ lat, lng })
  const [failed, setFailed] = useState(false)
  const centrePixel = project(centre.lat, centre.lng, zoom)
  const pin = project(lat, lng, zoom)
  // Square viewport keeps click coordinates and map scale accurate at every screen width.
  const width = 512
  const left = centrePixel.x - width / 2
  const top = centrePixel.y - width / 2
  const x0 = Math.floor(left / SIZE)
  const y0 = Math.floor(top / SIZE)
  const tiles = Array.from({ length: 9 }, (_, i) => ({
    x: x0 + (i % 3),
    y: y0 + Math.floor(i / 3),
  }))
  const radiusPixels = radius
    ? (radius * 1000) /
      ((156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom)
    : 0
  return (
    <div className="map-widget">
      <div
        className="pin-map"
        role="button"
        tabIndex={0}
        aria-label="Choose map pin. Click the map or adjust the coordinates below. Arrow keys move the pin."
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const next = unproject(
            left + ((e.clientX - rect.left) / rect.width) * width,
            top + ((e.clientY - rect.top) / rect.height) * width,
            zoom
          )
          onChange(Number(next.lat.toFixed(6)), Number(next.lng.toFixed(6)))
        }}
        onKeyDown={(e) => {
          const step = 0.002
          if (
            ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
          ) {
            e.preventDefault()
            onChange(
              lat +
                (e.key === "ArrowUp"
                  ? step
                  : e.key === "ArrowDown"
                    ? -step
                    : 0),
              lng +
                (e.key === "ArrowRight"
                  ? step
                  : e.key === "ArrowLeft"
                    ? -step
                    : 0)
            )
          }
        }}
      >
        {tiles.map((t) => (
          <img
            key={`${zoom}-${t.x}-${t.y}`}
            src={`https://tile.openstreetmap.org/${zoom}/${t.x}/${t.y}.png`}
            alt=""
            draggable={false}
            loading="lazy"
            onError={() => setFailed(true)}
            style={{
              left: `${((t.x * SIZE - left) / width) * 100}%`,
              top: `${((t.y * SIZE - top) / width) * 100}%`,
              width: "50%",
              height: "50%",
            }}
          />
        ))}
        {radius && (
          <span
            className="service-circle"
            style={{
              left: `${((pin.x - left) / width) * 100}%`,
              top: `${((pin.y - top) / width) * 100}%`,
              width: `${((radiusPixels * 2) / width) * 100}%`,
              height: `${((radiusPixels * 2) / width) * 100}%`,
            }}
          />
        )}
        <span
          className="map-pin"
          style={{
            left: `${((pin.x - left) / width) * 100}%`,
            top: `${((pin.y - top) / width) * 100}%`,
          }}
        >
          <MapPin fill="currentColor" size={35} />
        </span>
        <div className="map-controls" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => setZoom(Math.min(16, zoom + 1))}
          >
            <Plus size={18} />
          </button>
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => setZoom(Math.max(8, zoom - 1))}
          >
            <Minus size={18} />
          </button>
          <button type="button" onClick={() => setCentre({ lat, lng })}>
            Recenter
          </button>
        </div>
        <a
          className="map-credit"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          © OpenStreetMap contributors
        </a>
      </div>
      {failed && (
        <small className="map-warning">
          Map tiles are unavailable. You can still set the coordinates below.
        </small>
      )}
      <p className="map-hint">
        Click to set the {radius ? "service-area center" : "location pin"}. Use
        Recenter to move the map to your pin.
      </p>
    </div>
  )
}

import { MapPin, Search } from "lucide-react"
import { useState, type KeyboardEvent } from "react"

export type Location = { name: string; address: string; category: string }

type Props = {
  id: string
  label: string
  locations: Location[]
  value: string
  onChange: (value: string) => void
  onSelect: (location: Location) => void
}

export function LocationSearch({
  id,
  label,
  locations,
  value,
  onChange,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const matches = locations.filter((place) =>
    `${place.name} ${place.address} ${place.category}`
      .toLowerCase()
      .includes(value.trim().toLowerCase())
  )

  function choose(place: Location) {
    onSelect(place)
    setOpen(false)
    setActiveIndex(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false)
      setActiveIndex(-1)
    } else if (event.key === "ArrowDown") {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => Math.min(index + 1, matches.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (
      event.key === "Enter" &&
      open &&
      activeIndex >= 0 &&
      matches[activeIndex]
    ) {
      event.preventDefault()
      choose(matches[activeIndex])
    }
  }

  return (
    <div className="relative">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[#87958a]"
        />
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-activedescendant={
            open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined
          }
          required
          autoComplete="off"
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            setActiveIndex(-1)
          }}
          onChange={(event) => {
            onChange(event.target.value)
            setOpen(true)
            setActiveIndex(-1)
          }}
          onKeyDown={handleKeyDown}
          placeholder={`Search for a ${label.toLowerCase()}`}
          className="h-12 w-full rounded-lg border border-[#dce3dd] bg-white pr-4 pl-11 text-sm transition outline-none placeholder:text-[#929e95] focus:border-[#27805c] focus:ring-3 focus:ring-[#27805c]/15"
        />
      </div>
      {open && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-[#dce3dd] bg-white p-1.5 shadow-[0_14px_36px_rgba(20,48,32,0.15)]"
        >
          {matches.length ? (
            matches.map((place, index) => (
              <div
                key={place.name}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={activeIndex === index}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(place)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 ${activeIndex === index ? "bg-[#eef5f0]" : "hover:bg-[#f6f8f5]"}`}
              >
                <MapPin
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-[#498664]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[#20372a]">
                    {place.name}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-[#77847a]">
                    {place.address}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] text-[#8b988e]">
                  {place.category}
                </span>
              </div>
            ))
          ) : (
            <p className="px-3 py-4 text-sm text-[#78877c]">
              No places found. Try another name.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

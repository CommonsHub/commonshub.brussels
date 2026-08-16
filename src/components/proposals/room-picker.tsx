"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Users } from "lucide-react";
import { formatEur, formatTokens } from "@/modules/proposals/funding";

export interface RoomOption {
  slug: string;
  name: string;
  capacity: number;
  pricePerHour: number;
  tokensPerHour: number;
  image?: string;
}

interface RoomEvent {
  start: string;
  end: string;
  roomId: string;
  title?: string;
}

type Availability = "free" | "busy" | "too-small" | "unknown";

/**
 * Pick a room by looking at them. Rooms that cannot work — too small for the
 * headcount, or already booked on the day — stay visible but say why, because
 * "the Ostrom is taken that day" is useful information, and hiding it just
 * looks like the room does not exist.
 */
export function RoomPicker({
  rooms,
  selected,
  onSelect,
  expectedPeople,
  dates,
}: {
  rooms: RoomOption[];
  selected: string | null;
  onSelect: (slug: string | null) => void;
  expectedPeople: number;
  dates: string[];
}) {
  const [events, setEvents] = useState<RoomEvent[] | null>(null);

  const days = useMemo(() => dates.filter(Boolean).sort(), [dates]);

  useEffect(() => {
    if (days.length === 0) {
      setEvents(null);
      return;
    }
    let cancelled = false;
    const start = days[0];
    const end = days[days.length - 1];
    fetch(`/api/room-events?start=${start}&end=${end}T23:59:59`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => !cancelled && setEvents(data?.events ?? []))
      .catch(() => !cancelled && setEvents(null));
    return () => {
      cancelled = true;
    };
  }, [days]);

  /** Which rooms already have something on one of the chosen days. */
  const busyRooms = useMemo(() => {
    if (!events || days.length === 0) return new Set<string>();
    const busy = new Set<string>();
    for (const event of events) {
      const day = event.start.slice(0, 10);
      if (days.includes(day)) busy.add(event.roomId);
    }
    return busy;
  }, [events, days]);

  function availabilityOf(room: RoomOption): Availability {
    if (room.capacity < expectedPeople) return "too-small";
    if (days.length === 0 || events === null) return "unknown";
    return busyRooms.has(room.slug) ? "busy" : "free";
  }

  const fitting = rooms.filter((r) => r.capacity >= expectedPeople).length;

  return (
    <div className="space-y-3">
      <div
        className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x"
        role="radiogroup"
        aria-label="Room"
      >
        {/* Any room first: it is the default, and the one that gets a proposal
            moving when the room is not the point yet. */}
        <button
          type="button"
          role="radio"
          aria-checked={selected === null}
          onClick={() => onSelect(null)}
          className={`snap-start shrink-0 w-40 rounded-lg border-2 text-left transition-colors overflow-hidden ${
            selected === null ? "border-primary" : "border-border hover:border-primary/40"
          }`}
        >
          <div className="h-20 bg-muted flex items-center justify-center">
            {selected === null ? (
              <Check className="w-6 h-6 text-primary" />
            ) : (
              <Users className="w-6 h-6 text-muted-foreground" />
            )}
          </div>
          <div className="p-2 space-y-0.5">
            <p className="font-medium text-sm">Any room</p>
            <p className="text-xs text-muted-foreground">A steward finds one that fits</p>
            <p className="text-xs text-muted-foreground">
              {fitting} {fitting === 1 ? "room fits" : "rooms fit"} {expectedPeople}
            </p>
          </div>
        </button>

        {rooms.map((room) => {
          const availability = availabilityOf(room);
          const disabled = availability === "too-small";
          const isSelected = selected === room.slug;

          return (
            <button
              key={room.slug}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-disabled={disabled}
              onClick={() => !disabled && onSelect(room.slug)}
              className={`snap-start shrink-0 w-40 rounded-lg border-2 text-left transition-colors overflow-hidden ${
                isSelected ? "border-primary" : "border-border hover:border-primary/40"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="h-20 bg-muted relative">
                {room.image && (
                  // Plain img: these are small static room photos and this list
                  // scrolls, so the loader machinery buys us nothing here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={room.image}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
                {isSelected && (
                  <span className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <Check className="w-6 h-6 text-primary" />
                  </span>
                )}
              </div>

              <div className="p-2 space-y-0.5">
                <p className="font-medium text-sm truncate">{room.name}</p>
                <p className="text-xs text-muted-foreground">
                  Seats {room.capacity} ·{" "}
                  {room.pricePerHour > 0 ? `${formatEur(room.pricePerHour)}/h` : "free"}
                </p>
                {room.tokensPerHour > 0 && (
                  <p className="text-xs text-muted-foreground">
                    or {formatTokens(room.tokensPerHour)}/h
                  </p>
                )}

                {availability === "too-small" && (
                  <p className="text-xs text-destructive">Too small for {expectedPeople}</p>
                )}
                {availability === "busy" && (
                  <p className="text-xs text-amber-600 dark:text-amber-500">
                    Something else is booked that day
                  </p>
                )}
                {availability === "free" && <p className="text-xs text-primary">Free that day</p>}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {days.length === 0
          ? "Pick a date above and we will show what is free."
          : events === null
            ? "We could not check the calendar just now — a steward will."
            : "Availability is for the dates you picked. A room with something else on can still work if the times do not clash."}
      </p>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Users, X } from "lucide-react";
import { formatEur, formatTokens } from "@/modules/proposals/funding";

export interface RoomOption {
  slug: string;
  name: string;
  capacity: number;
  pricePerHour: number;
  tokensPerHour: number;
  image?: string;
}

export interface SlotInput {
  date: string;
  start: string;
  duration: number;
}

interface RoomEvent {
  start: string;
  end: string;
  roomId: string;
  title?: string;
}

interface SlotFit {
  label: string;
  free: boolean;
  clash?: string;
}

function slotRange(slot: SlotInput): { from: number; to: number } | null {
  const from = new Date(`${slot.date}T${slot.start}:00`).getTime();
  if (Number.isNaN(from)) return null;
  return { from, to: from + slot.duration * 3_600_000 };
}

function shortDay(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-BE", { weekday: "short", day: "numeric", month: "short" });
}

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Pick a room by looking at it — photo, capacity, price — with, per room, a
 * line for each of the chosen time slots saying whether that room is free
 * then, and what clashes with it if not. Rooms that cannot work stay visible
 * and say why, because "the Ostrom is taken that evening" is information.
 */
export function RoomPicker({
  rooms,
  selected,
  onSelect,
  expectedPeople,
  slots,
}: {
  rooms: RoomOption[];
  selected: string | null;
  onSelect: (slug: string | null) => void;
  expectedPeople: number;
  slots: SlotInput[];
}) {
  const [events, setEvents] = useState<RoomEvent[] | null>(null);

  const validSlots = useMemo(
    () => slots.filter((s) => s.date && slotRange(s) !== null),
    [slots],
  );
  const days = useMemo(
    () => Array.from(new Set(validSlots.map((s) => s.date))).sort(),
    [validSlots],
  );

  useEffect(() => {
    if (days.length === 0) {
      setEvents(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/room-events?start=${days[0]}&end=${days[days.length - 1]}T23:59:59`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => !cancelled && setEvents(data?.events ?? []))
      .catch(() => !cancelled && setEvents(null));
    return () => {
      cancelled = true;
    };
  }, [days]);

  /** For one room: how each requested slot fares against what is booked. */
  function fits(room: RoomOption): SlotFit[] {
    if (events === null) return [];
    return validSlots.map((slot) => {
      const range = slotRange(slot)!;
      const clash = events.find((event) => {
        if (event.roomId !== room.slug) return false;
        const from = new Date(event.start).getTime();
        const to = new Date(event.end).getTime();
        return from < range.to && to > range.from;
      });
      return {
        label: `${shortDay(slot.date)} ${slot.start}`,
        free: !clash,
        clash: clash ? `${hhmm(clash.start)}–${hhmm(clash.end)} booked` : undefined,
      };
    });
  }

  const fitting = rooms.filter((r) => r.capacity >= expectedPeople).length;

  return (
    <div className="space-y-3">
      <div
        className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x"
        role="radiogroup"
        aria-label="Room"
      >
        {/* Any room first: the default that keeps a proposal moving. */}
        <button
          type="button"
          role="radio"
          aria-checked={selected === null}
          onClick={() => onSelect(null)}
          className={`snap-start shrink-0 w-44 rounded-lg border-2 text-left transition-colors overflow-hidden ${
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
          const tooSmall = room.capacity < expectedPeople;
          const slotFits = fits(room);
          const isSelected = selected === room.slug;
          const allFree = slotFits.length > 0 && slotFits.every((f) => f.free);

          return (
            <button
              key={room.slug}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-disabled={tooSmall}
              onClick={() => !tooSmall && onSelect(room.slug)}
              className={`snap-start shrink-0 w-44 rounded-lg border-2 text-left transition-colors overflow-hidden ${
                isSelected ? "border-primary" : "border-border hover:border-primary/40"
              } ${tooSmall ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <div className="h-20 bg-muted relative">
                {room.image && (
                  // Plain img: small static photos in a scroll strip.
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
                  {room.tokensPerHour > 0 && <> · {formatTokens(room.tokensPerHour)}/h</>}
                </p>

                {tooSmall ? (
                  <p className="text-xs text-destructive">Too small for {expectedPeople}</p>
                ) : slotFits.length > 0 ? (
                  <ul className="space-y-0.5 pt-0.5">
                    {slotFits.map((fit, index) => (
                      <li
                        key={index}
                        className={`text-xs flex items-start gap-1 ${
                          fit.free ? "text-primary" : "text-amber-600 dark:text-amber-500"
                        }`}
                      >
                        {fit.free ? (
                          <Check className="w-3 h-3 mt-0.5 shrink-0" />
                        ) : (
                          <X className="w-3 h-3 mt-0.5 shrink-0" />
                        )}
                        <span>
                          {fit.label}
                          {fit.clash && (
                            <span className="block text-muted-foreground">{fit.clash}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : allFree ? null : (
                  <p className="text-xs text-muted-foreground">Pick a date to see availability</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {validSlots.length === 0
          ? "Add a date above and every room shows whether it is free then."
          : events === null
            ? "We could not check the calendar just now — a steward will."
            : "Checked against the live room calendar, slot by slot. A clash only matters if the times truly overlap."}
      </p>
    </div>
  );
}

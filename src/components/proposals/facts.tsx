"use client";

/**
 * The facts of a proposal as chips — dates, room, headcount, price — and, for
 * its author, each chip is a door: tap it and the editor for that fact opens
 * right underneath. Saving lands in the thread as a new version with a diff,
 * like any other edit.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RoomPicker, type RoomOption, type SlotInput } from "./room-picker";
import { formatEur, formatTokens } from "@/modules/proposals/funding";

type Editor = "none" | "dates" | "room" | "people" | "tickets";

interface Tickets {
  eur: number | null;
  tokens: number | null;
  freeForMembers: boolean;
}

function whenShort(slot: SlotInput): string {
  const date = new Date(`${slot.date}T${slot.start}:00`);
  if (Number.isNaN(date.getTime())) return `${slot.date} ${slot.start}`;
  return `${date.toLocaleDateString("en-BE", { weekday: "short", day: "numeric", month: "short" })} · ${slot.start} · ${slot.duration}h`;
}

export function ProposalFacts({
  proposalId,
  mayEdit,
  rooms,
  roomName,
  slots: initialSlots,
  roomSlug: initialRoom,
  expectedPeople: initialPeople,
  minAttendees,
  maxAttendees,
  tickets: initialTickets,
}: {
  proposalId: string;
  mayEdit: boolean;
  rooms: RoomOption[];
  roomName: string | null;
  slots: SlotInput[];
  roomSlug: string | null;
  expectedPeople: number;
  minAttendees: number | null;
  maxAttendees: number | null;
  tickets: Tickets;
}) {
  const router = useRouter();
  const [editor, setEditor] = useState<Editor>("none");
  const [slots, setSlots] = useState<SlotInput[]>(initialSlots);
  const [roomSlug, setRoomSlug] = useState<string | null>(initialRoom);
  const [people, setPeople] = useState(initialPeople);
  const [range, setRange] = useState<[number, number]>([
    minAttendees ?? 5,
    maxAttendees ?? initialPeople,
  ]);
  const [tickets, setTickets] = useState<Tickets>(initialTickets);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(which: Editor) {
    if (!mayEdit) return;
    setError(null);
    setEditor((current) => (current === which ? "none" : which));
  }

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "That did not save.");
      setEditor("none");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  }

  const chip = (label: string, which: Editor) =>
    mayEdit ? (
      <button
        type="button"
        onClick={() => open(which)}
        className={`rounded-full border px-2.5 py-1 inline-flex items-center gap-1 transition-colors ${
          editor === which ? "border-primary bg-primary/10" : "hover:border-primary/50"
        }`}
      >
        {label}
        <Pencil className="w-3 h-3 text-muted-foreground" />
      </button>
    ) : (
      <span className="rounded-full border px-2.5 py-1">{label}</span>
    );

  const price =
    tickets.eur || tickets.tokens
      ? [
          tickets.eur ? formatEur(tickets.eur) : null,
          tickets.tokens ? formatTokens(tickets.tokens) : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : "Free";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 text-xs">
        {slots.map((slot, index) => (
          <span key={index}>{chip(whenShort(slot), "dates")}</span>
        ))}
        {chip(roomSlug ? (roomName ?? roomSlug) : "Any room", "room")}
        {chip(
          minAttendees !== null || maxAttendees !== null
            ? `${minAttendees ?? "any"}–${maxAttendees ?? people} people`
            : `~${people} people`,
          "people",
        )}
        {chip(price, "tickets")}
      </div>

      {editor === "dates" && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          {slots.map((slot, index) => (
            <div key={index} className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_auto] gap-2 items-end">
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label className="text-xs">Date {index + 1}</Label>
                <Input
                  type="date"
                  value={slot.date}
                  onChange={(e) =>
                    setSlots((c) => c.map((s, i) => (i === index ? { ...s, date: e.target.value } : s)))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Start</Label>
                <Input
                  type="time"
                  value={slot.start}
                  onChange={(e) =>
                    setSlots((c) => c.map((s, i) => (i === index ? { ...s, start: e.target.value } : s)))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hours</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  step={0.5}
                  value={slot.duration}
                  onChange={(e) =>
                    setSlots((c) =>
                      c.map((s, i) => (i === index ? { ...s, duration: Number(e.target.value) } : s)),
                    )
                  }
                />
              </div>
              <div className="flex justify-end">
                {slots.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSlots((c) => c.filter((_, i) => i !== index))}
                    aria-label={`Remove date ${index + 1}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSlots((c) => [...c, { date: "", start: "18:00", duration: 2 }])}
            >
              <Plus className="w-4 h-4 mr-1" /> Add another date
            </Button>
            <Button
              size="sm"
              onClick={() => save({ slots: slots.filter((s) => s.date) })}
              disabled={busy || slots.every((s) => !s.date)}
            >
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save dates
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {editor === "room" && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <RoomPicker
            rooms={rooms}
            selected={roomSlug}
            onSelect={setRoomSlug}
            expectedPeople={people}
            slots={slots}
          />
          <Button size="sm" onClick={() => save({ roomSlug })} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save room
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {editor === "people" && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <Label className="text-xs">How many people?</Label>
            <span className="text-sm tabular-nums">
              {range[0]} – {range[1]}
            </span>
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={range}
            onValueChange={(value) =>
              setRange([Math.min(...value), Math.max(...value)] as [number, number])
            }
            aria-label="Minimum and maximum attendees"
          />
          <Button
            size="sm"
            onClick={() => {
              setPeople(range[1]);
              save({
                expectedPeople: range[1],
                minAttendees: range[0] > 0 ? range[0] : null,
                maxAttendees: range[1],
              });
            }}
            disabled={busy}
          >
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {editor === "tickets" && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1 w-28">
              <Label className="text-xs">Price in €</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={tickets.eur ?? ""}
                onChange={(e) =>
                  setTickets((t) => ({ ...t, eur: e.target.value === "" ? null : Number(e.target.value) }))
                }
              />
            </div>
            <div className="space-y-1 w-28">
              <Label className="text-xs">In tokens</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                value={tickets.tokens ?? ""}
                onChange={(e) =>
                  setTickets((t) => ({
                    ...t,
                    tokens: e.target.value === "" ? null : Number(e.target.value),
                  }))
                }
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave both empty for a free event. A price in euros needs one in tokens.
          </p>
          <Button size="sm" onClick={() => save({ tickets })} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save price
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </div>
  );
}

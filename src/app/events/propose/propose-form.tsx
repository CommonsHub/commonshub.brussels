"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  fundingTarget,
  formatEur,
  formatTokens,
  suggestTokenPrice,
  splitEuroContribution,
} from "@/modules/proposals/funding";
import { SUGGESTED_NEEDS } from "@/modules/tasks/needs";
import { RoomPicker } from "@/components/proposals/room-picker";
import type { Me } from "@/modules/identity/client";

import type { RoomOption } from "@/components/proposals/room-picker";

interface SlotDraft {
  date: string;
  start: string;
  duration: number;
}

const emptySlot = (): SlotDraft => ({ date: "", start: "18:00", duration: 2 });

export interface ProposalInitial {
  id: string;
  number: number;
  title: string;
  description: string;
  link: string | null;
  slots: SlotDraft[];
  roomSlug: string | null;
  expectedPeople: number;
  minAttendees: number | null;
  maxAttendees: number | null;
  audience: "public" | "members" | "invite";
  tickets: { eur: number | null; tokens: number | null; freeForMembers: boolean };
}

export function ProposeForm({
  rooms,
  me,
  initial,
}: {
  rooms: RoomOption[];
  me: Me | null;
  /** Present when editing an existing proposal rather than opening a new one. */
  initial?: ProposalInitial;
}) {
  const router = useRouter();
  const editing = !!initial;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [slots, setSlots] = useState<SlotDraft[]>(
    initial?.slots.length ? initial.slots : [emptySlot()],
  );
  const [roomSlug, setRoomSlug] = useState<string | null>(initial?.roomSlug ?? null);
  const [attendeeRange, setAttendeeRange] = useState<[number, number]>([
    initial?.minAttendees ?? 5,
    initial?.maxAttendees ?? initial?.expectedPeople ?? 30,
  ]);
  const expectedPeople = attendeeRange[1];
  const [audience, setAudience] = useState<"public" | "members" | "invite">(
    initial?.audience ?? "public",
  );
  const [paid, setPaid] = useState(!!(initial?.tickets.eur || initial?.tickets.tokens));
  const [eurPrice, setEurPrice] = useState<number | "">(initial?.tickets.eur ?? "");
  const [tokenPrice, setTokenPrice] = useState<number | "">(initial?.tickets.tokens ?? "");
  const [freeForMembers, setFreeForMembers] = useState(initial?.tickets.freeForMembers ?? true);
  const [needs, setNeeds] = useState<string[]>(["Cleaning"]);
  const [customNeed, setCustomNeed] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchState, setFetchState] = useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "ok"; source: string; got: string[] } | { kind: "none" }
  >({ kind: "idle" });

  /** Read the event page behind the link and pre-fill whatever it tells us. */
  async function fetchFromLink() {
    const url = link.trim();
    if (!url || editing) return;
    setFetchState({ kind: "loading" });
    try {
      const response = await fetch(`/api/og-preview?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (!data?.found) {
        setFetchState({ kind: "none" });
        return;
      }
      const got: string[] = [];
      if (data.title && !title.trim()) {
        setTitle(data.title);
        got.push("title");
      }
      if (data.description && !description.trim()) {
        setDescription(data.description);
        got.push("description");
      }
      if (data.start) {
        const startDate = new Date(data.start);
        const parts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Europe/Brussels",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).formatToParts(startDate);
        const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
        const date = `${get("year")}-${get("month")}-${get("day")}`;
        const start = `${get("hour")}:${get("minute")}`;
        let duration = 2;
        if (data.end) {
          const hours = (new Date(data.end).getTime() - startDate.getTime()) / 3_600_000;
          if (hours > 0 && hours <= 24) duration = Math.round(hours * 2) / 2;
        }
        setSlots([{ date, start, duration }]);
        got.push("date");
      }
      setFetchState(got.length ? { kind: "ok", source: data.source, got } : { kind: "none" });
    } catch {
      setFetchState({ kind: "none" });
    }
  }

  const hours = useMemo(() => Math.max(...slots.map((s) => s.duration || 0), 0), [slots]);

  const target = useMemo(
    () => fundingTarget({ roomSlug, hours, expectedPeople }),
    [roomSlug, hours, expectedPeople],
  );

  const fitsRoom = useMemo(() => {
    if (!roomSlug) return true;
    const room = rooms.find((r) => r.slug === roomSlug);
    return !room || room.capacity >= expectedPeople;
  }, [roomSlug, rooms, expectedPeople]);

  function updateSlot(index: number, patch: Partial<SlotDraft>) {
    setSlots((current) => current.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function toggleNeed(label: string, mandatory: boolean) {
    if (mandatory) return;
    setNeeds((current) =>
      current.includes(label) ? current.filter((n) => n !== label) : [...current, label],
    );
  }

  function addCustomNeed() {
    const value = customNeed.trim();
    if (!value) return;
    if (!needs.some((n) => n.toLowerCase() === value.toLowerCase())) {
      setNeeds((current) => [...current, value]);
    }
    setCustomNeed("");
  }

  function applyEurPrice(value: number | "") {
    setEurPrice(value);
    if (typeof value === "number" && value > 0 && tokenPrice === "") {
      const suggestion = suggestTokenPrice(value, target.roomSlug);
      if (suggestion) setTokenPrice(suggestion);
    }
  }

  async function submit() {
    setError(null);

    if (!title.trim()) return setError("Give it a name people will recognise.");
    if (slots.some((s) => !s.date)) return setError("Every date needs a day picked.");
    if (paid && !eurPrice && !tokenPrice) return setError("Set a price, or make it free.");
    if (paid && eurPrice && !tokenPrice) {
      return setError("A price in euros needs a price in tokens too, so members can pay in tokens.");
    }

    setSubmitting(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim(),
        link: link.trim() || null,
        slots,
        roomSlug,
        // The top of the range is what rooms are sized against.
        expectedPeople: attendeeRange[1],
        minAttendees: attendeeRange[0] > 0 ? attendeeRange[0] : null,
        maxAttendees: attendeeRange[1],
        audience,
        tickets: {
          eur: paid && eurPrice !== "" ? Number(eurPrice) : null,
          tokens: paid && tokenPrice !== "" ? Number(tokenPrice) : null,
          freeForMembers,
        },
        ...(editing ? {} : { needs }),
      };

      const response = await fetch(editing ? `/api/proposals/${initial.id}` : "/api/proposals", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "That did not go through.");
      router.push(`/proposals/${data.proposal.number}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not go through.");
      setSubmitting(false);
    }
  }

  if (!me) {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <p className="text-muted-foreground">
            Sign in first, so people can see who is proposing and reach you about it.
          </p>
          <Button asChild>
            <a href="/signin?next=/events/propose">Sign in</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>What do you want to make happen?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="link">Already announced somewhere? Start with the link</Label>
            <Input
              id="link"
              type="url"
              inputMode="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onBlur={fetchFromLink}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  fetchFromLink();
                }
              }}
              placeholder="A Luma, Eventbrite or Meetup page — we fill in what it tells us"
            />
            {fetchState.kind === "loading" && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Reading that page…
              </p>
            )}
            {fetchState.kind === "ok" && (
              <p className="text-xs text-primary">
                ✓ Picked up the {fetchState.got.join(", ")} from {fetchState.source} — check and
                adjust below.
              </p>
            )}
            {fetchState.kind === "none" && (
              <p className="text-xs text-muted-foreground">
                Could not read details from that page — no problem, fill them in below.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Event name</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Repair café: bring your broken thing"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happens, who it is for, what people should bring."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>When</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You can add multiple dates — the more that work for you, the easier it is to find a
            free room.
          </p>
          {slots.map((slot, index) => (
            <div key={index} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Date {index + 1}
                </span>
                {slots.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={() => setSlots((c) => c.filter((_, i) => i !== index))}
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Remove
                  </Button>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`date-${index}`}>Date</Label>
                <Input
                  id={`date-${index}`}
                  type="date"
                  value={slot.date}
                  onChange={(e) => updateSlot(index, { date: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor={`start-${index}`}>Start</Label>
                  <Input
                    id={`start-${index}`}
                    type="time"
                    value={slot.start}
                    onChange={(e) => updateSlot(index, { start: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label htmlFor={`hours-${index}`}>Hours</Label>
                  <Input
                    id={`hours-${index}`}
                    type="number"
                    min={1}
                    max={12}
                    step={0.5}
                    value={slot.duration}
                    onChange={(e) => updateSlot(index, { duration: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setSlots((c) => [...c, emptySlot()])}>
            <Plus className="w-4 h-4 mr-1" /> Add another date
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where, and how many</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Headcount first: it is what decides which rooms can work at all. */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <Label>How many people?</Label>
              <span className="text-sm tabular-nums">
                {attendeeRange[0]} – {attendeeRange[1]}
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              value={attendeeRange}
              onValueChange={(value) =>
                setAttendeeRange([Math.min(...value), Math.max(...value)] as [number, number])
              }
              aria-label="Minimum and maximum attendees"
            />
            <p className="text-xs text-muted-foreground">
              It happens from {attendeeRange[0] || "any number of"}{" "}
              {attendeeRange[0] === 1 ? "person" : "people"}, and caps at {attendeeRange[1]}.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Which room?</Label>
            <RoomPicker
              rooms={rooms}
              selected={roomSlug}
              onSelect={setRoomSlug}
              expectedPeople={expectedPeople}
              slots={slots}
            />
          </div>

          {!fitsRoom && (
            <p className="text-sm text-amber-600 dark:text-amber-500">
              That room seats fewer people than you expect. It can still work — a steward will say.
            </p>
          )}

          <div className="rounded-lg border p-4 space-y-1 bg-muted/40">
            <p className="text-sm font-medium">
              Minimum contribution to the hub: {formatEur(target.eur)} or {formatTokens(target.tokens)}
            </p>
            <p className="text-xs text-muted-foreground">
              {target.roomName
                ? `${hours}h in the ${target.roomName}${target.estimated ? " — our guess from your headcount, until a room is picked" : ""}`
                : "Pick a room or a headcount to see what the room costs."}
            </p>
            <p className="text-xs text-muted-foreground">
              Tickets and donations both count towards it. Once it is covered, a steward can put the
              event on the calendar. If it never gets there, everyone who contributed is refunded.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Who can come, and what it costs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["public", "Open to everyone"],
                ["members", "Members only"],
                ["invite", "Invite only"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={audience === value ? "default" : "outline"}
                size="sm"
                onClick={() => setAudience(value)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={!paid ? "default" : "outline"} size="sm" onClick={() => setPaid(false)}>
              Free
            </Button>
            <Button type="button" variant={paid ? "default" : "outline"} size="sm" onClick={() => setPaid(true)}>
              Ticketed
            </Button>
          </div>

          {paid ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <div className="space-y-2 w-32">
                  <Label htmlFor="eur">Price in €</Label>
                  <Input
                    id="eur"
                    type="number"
                    min={0}
                    step={0.5}
                    value={eurPrice}
                    onChange={(e) => applyEurPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2 w-32">
                  <Label htmlFor="tokens">Price in tokens</Label>
                  <Input
                    id="tokens"
                    type="number"
                    min={0}
                    step={0.5}
                    value={tokenPrice}
                    onChange={(e) => setTokenPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Any price in euros needs a price in tokens, so members can pay the way they already
                hold value here.
                {typeof eurPrice === "number" && eurPrice > 0 && (
                  <>
                    {" "}
                    On a {formatEur(eurPrice)} ticket the hub keeps{" "}
                    {formatEur(splitEuroContribution(eurPrice).adminFee)} as its 10% admin fee, and{" "}
                    {formatEur(splitEuroContribution(eurPrice).net)} goes towards the room.
                  </>
                )}
              </p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="free-members"
                  checked={freeForMembers}
                  onCheckedChange={(v) => setFreeForMembers(v === true)}
                />
                <Label htmlFor="free-members" className="font-normal">
                  Members come free
                </Label>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              A free event still needs its room covered — people can donate towards it, in euros or
              tokens.
            </p>
          )}
        </CardContent>
      </Card>

      {!editing && (
      <Card>
        <CardHeader>
          <CardTitle>What it needs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This becomes a shared list anyone can add to and pick items off.
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_NEEDS.map((need) => {
              const active = need.mandatory || needs.includes(need.label);
              return (
                <Button
                  key={need.label}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  onClick={() => toggleNeed(need.label, need.mandatory)}
                  className={need.mandatory ? "cursor-default" : undefined}
                >
                  {need.label}
                  {need.mandatory && <span className="ml-1 text-xs opacity-80">· always</span>}
                </Button>
              );
            })}
          </div>

          {needs.filter((n) => !SUGGESTED_NEEDS.some((s) => s.label === n)).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {needs
                .filter((n) => !SUGGESTED_NEEDS.some((s) => s.label === n))
                .map((need) => (
                  <Button
                    key={need}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setNeeds((c) => c.filter((n) => n !== need))}
                  >
                    {need} <X className="w-3 h-3 ml-1" />
                  </Button>
                ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={customNeed}
              onChange={(e) => setCustomNeed(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomNeed();
                }
              }}
              placeholder="Something else — a sound system, a translator, a cake…"
            />
            <Button type="button" variant="outline" onClick={addCustomNeed}>
              Add
            </Button>
          </div>
        </CardContent>
      </Card>
      )}



      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={submitting} size="lg">
          {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {editing ? "Save changes" : "Post proposal"}
        </Button>
        <p className="text-sm text-muted-foreground">
          {editing
            ? "The change lands in the thread as a new version, with a diff."
            : `Posting as ${me.displayName}.`}
        </p>
      </div>

      {!editing && (
        <div className="pt-8 border-t space-y-5 text-sm">
          <h2 className="font-semibold text-base">What happens after you post?</h2>
          <div className="space-y-1">
            <p className="font-medium">Who sees it?</p>
            <p className="text-muted-foreground">
              Other members of the community will be able to chime in and contribute — comment,
              take something off the list, chip in towards the room, say they are coming.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">When is it confirmed?</p>
            <p className="text-muted-foreground">
              Once the different resources needed to make this event happen are secured, a steward
              confirms it in the calendar.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium">And if it never gets there?</p>
            <p className="text-muted-foreground">
              Then it does not happen, and everyone who contributed gets their money back — in the
              currency they paid.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

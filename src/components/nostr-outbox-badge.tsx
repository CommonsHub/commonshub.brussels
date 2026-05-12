"use client";

import { useState } from "react";
import { Inbox, RefreshCw, Trash2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNostr, type OutboxItem } from "@/components/nostr-provider";

function shortNpub(npub: string): string {
  if (!npub) return "";
  if (npub.length <= 14) return npub;
  return `${npub.slice(0, 8)}…${npub.slice(-4)}`;
}

function shortUri(uri: string): string {
  // ethereum:42220:address:0xabc…123 / stripe:txn_xxx
  const parts = uri.split(":");
  const tail = parts[parts.length - 1];
  if (tail && tail.startsWith("0x") && tail.length > 14) {
    parts[parts.length - 1] = `${tail.slice(0, 6)}…${tail.slice(-4)}`;
  }
  return parts.join(":");
}

function tagPreview(event: OutboxItem["event"]): string {
  const interesting = event.tags
    .filter(([k]) => k !== "i" && k !== "k")
    .map(([k, v]) => `${k}=${v ?? ""}`);
  if (event.content) interesting.unshift(`content="${event.content}"`);
  if (interesting.length === 0) return "(empty)";
  return interesting.join(", ");
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      aria-label={label}
      title={label}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-600" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

export function NostrOutboxBadge() {
  const { outbox, outboxCount, sync, ready, npub, removeFromOutbox } =
    useNostr();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  if (!ready) return null;
  if (outboxCount === 0) return null;

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allIds = outbox.map((i) => i.event.id);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selected.has(id));

  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(allIds));

  const removeSelected = () => {
    if (selected.size === 0) return;
    removeFromOutbox(Array.from(selected));
    setSelected(new Set());
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setOpen(true)}
              aria-label="Pending nostr events"
            >
              <Inbox className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center px-1">
                {outboxCount}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {outboxCount} pending event{outboxCount === 1 ? "" : "s"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pending nostr events</DialogTitle>
            <DialogDescription>
              Events queued in the local outbox. Sync to send them to the
              relay; remove any you don&apos;t want to publish.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Your npub:</span>
              <code className="font-mono">{shortNpub(npub)}</code>
              {npub && <CopyButton value={npub} label="Copy npub" />}
            </div>
          </div>

          {outbox.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              The outbox is empty.
            </p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto -mx-6 px-6 divide-y">
              <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
                <span>Select all</span>
              </div>
              {outbox.map((item) => {
                const id = item.event.id;
                const isSel = selected.has(id);
                return (
                  <div key={id} className="flex items-start gap-3 py-3">
                    <Checkbox
                      checked={isSel}
                      onCheckedChange={() => toggleOne(id)}
                      aria-label="Select event"
                    />
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="flex items-center gap-2">
                        <code className="font-mono break-all">
                          {shortUri(item.uri)}
                        </code>
                        <CopyButton value={item.uri} label="Copy URI" />
                      </div>
                      <div className="mt-1 text-muted-foreground break-words">
                        {tagPreview(item.event)}
                      </div>
                      {(item.attempts > 0 || item.lastError) && (
                        <div className="mt-1 text-amber-600 dark:text-amber-400">
                          {item.attempts} retr
                          {item.attempts === 1 ? "y" : "ies"}
                          {item.lastError ? ` — ${item.lastError}` : ""}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter className="flex sm:justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={selected.size === 0}
              onClick={removeSelected}
            >
              <Trash2 className="w-4 h-4" />
              Remove {selected.size > 0 ? `(${selected.size})` : ""}
            </Button>
            <Button size="sm" onClick={() => sync()}>
              <RefreshCw className="w-4 h-4" />
              Sync now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

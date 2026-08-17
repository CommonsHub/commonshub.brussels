"use client";

/**
 * The description, editable where it is read. The author taps "Add a
 * description" (or "edit") and writes right here — no separate page.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function InlineDescription({
  proposalId,
  description,
  mayEdit,
}: {
  proposalId: string;
  description: string;
  mayEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description);
  // What we show: the save shows immediately, and the server render catches up.
  const [current, setCurrent] = useState(description);
  useEffect(() => setCurrent(description), [description]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: draft.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "That did not save.");
      setCurrent(draft.trim());
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <Textarea
          rows={6}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="What happens, who it is for, what people should bring."
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(current);
              setEditing(false);
            }}
            disabled={busy}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (current) {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground whitespace-pre-wrap">{current}</p>
        {mayEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" /> edit description
          </button>
        )}
      </div>
    );
  }

  if (mayEdit) {
    return (
      <p className="text-muted-foreground">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-primary hover:underline"
        >
          Add a description
        </button>{" "}
        — say what happens, who it is for, what to bring.
      </p>
    );
  }

  return <p className="text-muted-foreground italic">No description provided.</p>;
}

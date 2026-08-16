"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CommentBox({
  proposalId,
  authorName,
}: {
  proposalId: string;
  authorName: string | null;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authorName) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        <a href="/signin" className="text-primary hover:underline">
          Sign in
        </a>{" "}
        to join the conversation.
      </div>
    );
  }

  async function submit() {
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/proposals/${proposalId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "That did not send.");
      setBody("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-xs text-muted-foreground">Commenting as {authorName}</p>
      <Textarea
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Offer a hand, ask a question, say what would make you come."
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={submit} disabled={busy || !body.trim()} size="sm">
        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Comment
      </Button>
    </div>
  );
}

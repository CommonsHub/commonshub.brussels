"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Attachment {
  url: string;
  mime: string;
  name: string;
}

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
  const [uploading, setUploading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch(`/api/proposals/${proposalId}/photos`, {
          method: "POST",
          body: form,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "That photo did not upload.");
        setAttachments((current) => [...current, data.attachment]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That photo did not upload.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

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
    if (!body.trim() && attachments.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/proposals/${proposalId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), attachments }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "That did not send.");
      setBody("");
      setAttachments([]);
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
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div key={attachment.url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.url}
                alt={attachment.name}
                className="w-20 h-20 object-cover rounded-md border"
              />
              <button
                type="button"
                onClick={() =>
                  setAttachments((current) => current.filter((a) => a.url !== attachment.url))
                }
                className="absolute -top-1.5 -right-1.5 rounded-full bg-background border p-0.5"
                aria-label={`Remove ${attachment.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={submit}
          disabled={busy || uploading || (!body.trim() && attachments.length === 0)}
          size="sm"
        >
          {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Comment
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addPhotos(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ImagePlus className="w-4 h-4 mr-2" />
          )}
          Add a photo
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { linkDiscordSession, requestEmailLink } from "@/modules/identity/client";

export function SignInForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") || "/events/proposals";
  const linking = params.get("link") === "1";

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "expired" ? "That link has expired. Ask for a new one." : null,
  );

  // Coming back from Discord: hand this browser's session key to the server.
  useEffect(() => {
    if (!linking) return;
    let cancelled = false;
    (async () => {
      const account = await linkDiscordSession();
      if (cancelled) return;
      if (account) router.replace(next);
      else setError("We could not finish signing you in with Discord. Try again.");
    })();
    return () => {
      cancelled = true;
    };
  }, [linking, next, router]);

  async function sendLink() {
    setBusy(true);
    setError(null);
    try {
      await requestEmailLink(email.trim(), next);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send that link.");
    } finally {
      setBusy(false);
    }
  }

  if (linking) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Finishing your sign-in…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          No password to remember. Your session lives in this browser and nothing leaves it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {sent ? (
          <div className="rounded-lg border p-4 space-y-2">
            <p className="font-medium flex items-center gap-2">
              <Mail className="w-4 h-4" /> Check your inbox
            </p>
            <p className="text-sm text-muted-foreground">
              We sent a link to {email}. It works once, in this browser, for the next 30 minutes.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="email">Your email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && email.includes("@") && sendLink()}
                placeholder="you@example.org"
              />
            </div>
            <Button onClick={sendLink} disabled={busy || !email.includes("@")} className="w-full">
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Email me a sign-in link
            </Button>
          </div>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() =>
              signIn("discord", { callbackUrl: `/signin?link=1&next=${encodeURIComponent(next)}` })
            }
          >
            Continue with Discord
          </Button>
          <p className="text-xs text-muted-foreground">
            Use Discord if you want to pay with tokens — that is where your tokens live, and it
            brings your roles across.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

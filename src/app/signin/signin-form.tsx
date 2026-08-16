"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { linkDiscordSession, requestEmailCode, submitEmailCode } from "@/modules/identity/client";

export function SignInForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") || "/events/proposals";
  const linking = params.get("link") === "1";

  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [linkFailed, setLinkFailed] = useState(false);

  // Coming back from Discord: hand this browser's session key to the server.
  useEffect(() => {
    if (!linking) return;
    let cancelled = false;
    (async () => {
      try {
        await linkDiscordSession();
        if (cancelled) return;
        router.replace(next);
        router.refresh();
      } catch (err) {
        if (cancelled) return;
        // Never leave the spinner running: say what happened and offer a way out.
        setLinkFailed(true);
        setError(
          err instanceof Error ? err.message : "We could not finish signing you in with Discord.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linking, next, router]);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      await requestEmailCode(email.trim());
      setStage("code");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not send that code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    setBusy(true);
    setError(null);
    try {
      await submitEmailCode(email.trim(), value);
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not work.");
      setCode("");
      setBusy(false);
    }
  }

  if (linking && !linkFailed) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Finishing your sign-in…</p>
        </CardContent>
      </Card>
    );
  }

  if (linkFailed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>That did not finish</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full"
            onClick={() =>
              signIn("discord", {
                callbackUrl: `/signin?link=1&next=${encodeURIComponent(next)}`,
              })
            }
          >
            Try Discord again
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setLinkFailed(false);
              setError(null);
              router.replace(`/signin?next=${encodeURIComponent(next)}`);
            }}
          >
            Use my email instead
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{stage === "code" ? "Check your email" : "Sign in"}</CardTitle>
        <CardDescription>
          {stage === "code" ? (
            <>We sent a six-digit code to {email}. It expires in 10 minutes.</>
          ) : (
            <>No password to remember. Your session lives in this browser and nothing leaves it.</>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {stage === "code" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Your code</Label>
              <InputOTP
                id="code"
                maxLength={6}
                value={code}
                disabled={busy}
                onChange={(value) => {
                  setCode(value);
                  if (value.length === 6) verify(value);
                }}
                autoFocus
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            {busy && (
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking…
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex flex-wrap gap-3">
              <Button variant="ghost" size="sm" onClick={() => setStage("email")} disabled={busy}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Use another address
              </Button>
              <Button variant="outline" size="sm" onClick={sendCode} disabled={busy}>
                Send a new code
              </Button>
            </div>
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
                onKeyDown={(e) => e.key === "Enter" && email.includes("@") && sendCode()}
                placeholder="you@example.org"
              />
            </div>
            <Button onClick={sendCode} disabled={busy || !email.includes("@")} className="w-full">
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Email me a code
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
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
      </CardContent>
    </Card>
  );
}

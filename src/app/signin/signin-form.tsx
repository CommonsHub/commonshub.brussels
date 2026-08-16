"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowLeft, Check, Fingerprint, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  RESEND_COOLDOWN_SECONDS,
  RetryLaterError,
  linkDiscordSession,
  linkEmail,
  passkeysSupported,
  registerPasskey,
  requestEmailCode,
  signInWithPasskey,
  submitEmailCode,
  type Me,
} from "@/modules/identity/client";

type Stage = "email" | "code" | "finish";

export function SignInForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = params.get("next") || "/events/proposals";
  const linking = params.get("link") === "1";

  const [stage, setStage] = useState<Stage>("email");
  const [me, setMe] = useState<Me | null>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [linkFailed, setLinkFailed] = useState(false);
  const [canUsePasskeys, setCanUsePasskeys] = useState(false);
  const [linkingEmail, setLinkingEmail] = useState(false);
  const [retryIn, setRetryIn] = useState(0);

  // Tick the resend cooldown down, so the button says when it comes back.
  useEffect(() => {
    if (retryIn <= 0) return;
    const timer = setInterval(() => setRetryIn((n) => Math.max(0, n - 1)), 1000);
    return () => clearInterval(timer);
  }, [retryIn]);

  useEffect(() => setCanUsePasskeys(passkeysSupported()), []);

  /** Signed in. Offer whatever is still missing, or get out of the way. */
  const settle = useCallback(
    (account: Me) => {
      setMe(account);
      const somethingToOffer =
        !account.hasDiscord || !account.hasEmail || (canUsePasskeys && !account.hasPasskey);
      if (somethingToOffer) {
        setStage("finish");
        setBusy(null);
      } else {
        router.replace(next);
        router.refresh();
      }
    },
    [canUsePasskeys, next, router],
  );

  // Coming back from Discord: hand this browser's session key to the server.
  useEffect(() => {
    if (!linking) return;
    let cancelled = false;
    (async () => {
      try {
        const account = await linkDiscordSession();
        if (cancelled) return;
        settle(account);
      } catch (err) {
        if (cancelled) return;
        setLinkFailed(true);
        setError(
          err instanceof Error ? err.message : "We could not finish signing you in with Discord.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linking, settle]);

  async function sendCode() {
    setBusy("code");
    setError(null);
    try {
      const { expiresInMinutes } = await requestEmailCode(email.trim());
      void expiresInMinutes;
      setStage("code");
      setCode("");
      setRetryIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const wait = err instanceof RetryLaterError ? err.retryInSeconds : 0;
      if (wait > 0) {
        setStage("code");
        setRetryIn(wait);
      }
      setError(err instanceof Error ? err.message : "We could not send that code.");
    } finally {
      setBusy(null);
    }
  }

  async function verify(value: string) {
    setBusy("verify");
    setError(null);
    try {
      const account = linkingEmail
        ? await linkEmail(email.trim(), value)
        : await submitEmailCode(email.trim(), value);
      if (linkingEmail) {
        setLinkingEmail(false);
        setNotice(`${email.trim()} is linked to your account.`);
        setStage("finish");
        setMe(account);
        setBusy(null);
        return;
      }
      settle(account);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code did not work.");
      setCode("");
      setBusy(null);
    }
  }

  async function usePasskey() {
    setBusy("passkey");
    setError(null);
    try {
      settle(await signInWithPasskey());
    } catch (err) {
      const message = err instanceof Error ? err.message : "That passkey did not work.";
      // A cancelled prompt is not an error worth shouting about.
      if (!/abort|cancel|NotAllowed/i.test(message)) setError(message);
      setBusy(null);
    }
  }

  async function addPasskey() {
    setBusy("register");
    setError(null);
    try {
      const label = await registerPasskey();
      setNotice(`Saved. Next time, ${label} gets you in without a code.`);
      setMe((current) => (current ? { ...current, hasPasskey: true } : current));
    } catch (err) {
      const message = err instanceof Error ? err.message : "That passkey did not save.";
      if (!/abort|cancel|NotAllowed/i.test(message)) setError(message);
    } finally {
      setBusy(null);
    }
  }

  function connectDiscord() {
    signIn("discord", { callbackUrl: `/signin?link=1&next=${encodeURIComponent(next)}` });
  }

  // ── coming back from Discord ──
  if (linking && !linkFailed && stage !== "finish") {
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
          <Button className="w-full" onClick={connectDiscord}>
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

  // ── everything that is still worth setting up ──
  if (stage === "finish" && me) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>You&apos;re in, {me.displayName}</CardTitle>
          <CardDescription>
            A couple of things that make this easier next time. You can skip them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notice && <p className="text-sm text-primary">{notice}</p>}

          {!me.hasDiscord && (
            <div className="rounded-lg border p-4 space-y-2">
              <p className="font-medium">Connect your Discord account</p>
              <p className="text-sm text-muted-foreground">
                It links this account to the one you already use at the hub — your roles, and the
                tokens you hold, come with it.
              </p>
              <Button variant="outline" size="sm" onClick={connectDiscord}>
                Connect Discord
              </Button>
            </div>
          )}

          {!me.hasEmail && !linkingEmail && (
            <div className="rounded-lg border p-4 space-y-2">
              <p className="font-medium">Add your email address</p>
              <p className="text-sm text-muted-foreground">
                Discord did not share one. We use it to tell you about the events you sign up for.
              </p>
              <Button variant="outline" size="sm" onClick={() => setLinkingEmail(true)}>
                Add an email address
              </Button>
            </div>
          )}

          {!me.hasEmail && linkingEmail && (
            <div className="rounded-lg border p-4 space-y-3">
              <Label htmlFor="link-email">Your email</Label>
              <Input
                id="link-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.org"
              />
              <Button size="sm" onClick={sendCode} disabled={busy !== null || !email.includes("@")}>
                {busy === "code" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Send me a code
              </Button>
            </div>
          )}

          {canUsePasskeys && !me.hasPasskey && (
            <div className="rounded-lg border p-4 space-y-2">
              <p className="font-medium flex items-center gap-2">
                <Fingerprint className="w-4 h-4" /> Set up a passkey
              </p>
              <p className="text-sm text-muted-foreground">
                Next time this device gets you in with your fingerprint or face — no code to wait
                for.
              </p>
              <Button variant="outline" size="sm" onClick={addPasskey} disabled={busy !== null}>
                {busy === "register" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Set up a passkey
              </Button>
            </div>
          )}

          {me.hasPasskey && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" /> Passkey ready on this device.
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full"
            onClick={() => {
              router.replace(next);
              router.refresh();
            }}
          >
            Continue
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── the code someone was emailed ──
  if (stage === "code") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent a six-digit code to {email}. It expires in 10 minutes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Your code</Label>
            <InputOTP
              id="code"
              maxLength={6}
              value={code}
              disabled={busy === "verify"}
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

          {busy === "verify" && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Checking…
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStage(linkingEmail ? "finish" : "email")}
              disabled={busy !== null}
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={sendCode}
              disabled={busy !== null || retryIn > 0}
            >
              {retryIn > 0 ? `Send a new code in ${retryIn}s` : "Send a new code"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── the front door ──
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          No password to remember. Your session lives in this browser and nothing leaves it.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {canUsePasskeys && (
          <Button variant="outline" className="w-full" onClick={usePasskey} disabled={busy !== null}>
            {busy === "passkey" ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Fingerprint className="w-4 h-4 mr-2" />
            )}
            Sign in with a passkey
          </Button>
        )}

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
          <Button onClick={sendCode} disabled={busy !== null || !email.includes("@")} className="w-full">
            {busy === "code" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Email me a code
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={connectDiscord}>
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

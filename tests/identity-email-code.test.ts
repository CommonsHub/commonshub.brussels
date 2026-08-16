import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chb-identity-"));
process.env.IDENTITY_DIR = dir;
process.env.IDENTITY_ENCRYPTION_KEY = "a".repeat(64);

import {
  CODE_RESEND_SECONDS,
  completeEmailLogin,
  startEmailLogin,
} from "@/modules/identity/service";
import { randomCode } from "@/modules/identity/crypto";

const SESSION = "b".repeat(64);

/** The tests want the code, and the cooldown is exercised separately below. */
function issue(email: string, sessionPubkey = SESSION): string {
  const result = startEmailLogin({ email, sessionPubkey });
  if (!result.ok) throw new Error(`throttled for ${result.retryInSeconds}s`);
  return result.code;
}
const OTHER_SESSION = "c".repeat(64);

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("the six-digit code", () => {
  it("is six digits, and not the same one twice", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const code = randomCode();
      expect(code).toMatch(/^\d{6}$/);
      codes.add(code);
    }
    expect(codes.size).toBeGreaterThan(40);
  });

  it("signs someone in and creates their account the first time", () => {
    const code = issue("ana@example.org", SESSION);
    const result = completeEmailLogin({
      email: "ana@example.org",
      code,
      sessionPubkey: SESSION,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.account.email).toBe("ana@example.org");
    expect(result.session.sessionPubkey).toBe(SESSION);
  });

  it("returns the same account on a second sign-in", () => {
    const first = issue("sofie@example.org");
    const a = completeEmailLogin({ email: "sofie@example.org", code: first, sessionPubkey: SESSION });
    const second = issue("sofie@example.org");
    const b = completeEmailLogin({ email: "sofie@example.org", code: second, sessionPubkey: SESSION });

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.account.id).toBe(a.account.id);
  });

  it("cannot be used twice", () => {
    const code = issue("tom@example.org", SESSION);
    expect(completeEmailLogin({ email: "tom@example.org", code, sessionPubkey: SESSION }).ok).toBe(true);

    const again = completeEmailLogin({ email: "tom@example.org", code, sessionPubkey: SESSION });
    expect(again.ok).toBe(false);
  });

  it("only works in the browser that asked for it", () => {
    const code = issue("rita@example.org", SESSION);
    const elsewhere = completeEmailLogin({
      email: "rita@example.org",
      code,
      sessionPubkey: OTHER_SESSION,
    });

    expect(elsewhere.ok).toBe(false);
    if (elsewhere.ok) return;
    expect(elsewhere.error).toMatch(/expired/i);
  });

  it("only works for the address it was sent to", () => {
    const code = issue("karim@example.org", SESSION);
    const wrongAddress = completeEmailLogin({
      email: "someone.else@example.org",
      code,
      sessionPubkey: SESSION,
    });
    expect(wrongAddress.ok).toBe(false);
  });

  it("burns out after five wrong guesses", () => {
    const code = issue("leila@example.org", SESSION);
    const wrong = code === "000000" ? "111111" : "000000";

    for (let attempt = 1; attempt <= 4; attempt++) {
      const result = completeEmailLogin({ email: "leila@example.org", code: wrong, sessionPubkey: SESSION });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/not right/i);
    }

    const fifth = completeEmailLogin({ email: "leila@example.org", code: wrong, sessionPubkey: SESSION });
    expect(fifth.ok).toBe(false);
    if (!fifth.ok) expect(fifth.error).toMatch(/too many/i);

    // Even the right code is dead now.
    const afterwards = completeEmailLogin({ email: "leila@example.org", code, sessionPubkey: SESSION });
    expect(afterwards.ok).toBe(false);
  });

  it("makes you wait before sending another one", () => {
    const first = startEmailLogin({ email: "wout@example.org", sessionPubkey: SESSION });
    expect(first.ok).toBe(true);

    const tooSoon = startEmailLogin({ email: "wout@example.org", sessionPubkey: SESSION });
    expect(tooSoon.ok).toBe(false);
    if (tooSoon.ok) return;
    expect(tooSoon.retryInSeconds).toBeGreaterThan(0);
    expect(tooSoon.retryInSeconds).toBeLessThanOrEqual(CODE_RESEND_SECONDS);

    // The first code still works while you wait — being throttled is not a lockout.
    if (!first.ok) return;
    const result = completeEmailLogin({
      email: "wout@example.org",
      code: first.code,
      sessionPubkey: SESSION,
    });
    expect(result.ok).toBe(true);
  });

  it("holds the cooldown per browser and address, not globally", () => {
    startEmailLogin({ email: "held@example.org", sessionPubkey: SESSION });

    // Another address, same browser.
    expect(startEmailLogin({ email: "other@example.org", sessionPubkey: SESSION }).ok).toBe(true);
    // Same address, another browser.
    expect(
      startEmailLogin({ email: "held@example.org", sessionPubkey: OTHER_SESSION }).ok,
    ).toBe(true);
  });

  it("replaces the previous code once the wait is over", () => {
    const first = startEmailLogin({ email: "later@example.org", sessionPubkey: SESSION });
    expect(first.ok).toBe(true);

    const realNow = Date.now;
    Date.now = () => realNow() + (CODE_RESEND_SECONDS + 1) * 1000;
    try {
      const second = startEmailLogin({ email: "later@example.org", sessionPubkey: SESSION });
      expect(second.ok).toBe(true);
      if (!second.ok || !first.ok) return;

      const stale = completeEmailLogin({
        email: "later@example.org",
        code: first.code,
        sessionPubkey: SESSION,
      });
      expect(stale.ok).toBe(false);

      const fresh = completeEmailLogin({
        email: "later@example.org",
        code: second.code,
        sessionPubkey: SESSION,
      });
      expect(fresh.ok).toBe(true);
    } finally {
      Date.now = realNow;
    }
  });

  it("never writes the code to disk in the clear", () => {
    const code = issue("quiet@example.org", SESSION);
    const stored = fs.readFileSync(path.join(dir, "identity.json"), "utf-8");
    expect(stored).not.toContain(code);
  });
});

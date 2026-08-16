import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chb-linking-"));
process.env.IDENTITY_DIR = dir;
process.env.IDENTITY_ENCRYPTION_KEY = "d".repeat(64);

import {
  completeEmailLogin,
  linkDiscordToAccount,
  linkEmailToAccount,
  publicProfile,
  rolesFromDiscord,
  startEmailLogin,
  upsertDiscordAccount,
} from "@/modules/identity/service";
import { findAccount, findAccountByEmail } from "@/modules/identity/store";

const SESSION = "e".repeat(64);

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

function signInByEmail(email: string) {
  const { code } = startEmailLogin({ email, sessionPubkey: SESSION });
  const result = completeEmailLogin({ email, code, sessionPubkey: SESSION });
  if (!result.ok) throw new Error(result.error);
  return result.account;
}

describe("connecting Discord to an email account", () => {
  it("keeps one account, with both ways in", () => {
    const account = signInByEmail("ana@example.org");
    expect(publicProfile(account).hasDiscord).toBe(false);

    const linked = linkDiscordToAccount(account.id, {
      discordId: "111",
      username: "ana",
      roleNames: ["coworker"],
    });

    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.account.id).toBe(account.id);
    expect(linked.account.email).toBe("ana@example.org");
    expect(linked.account.discordId).toBe("111");
    expect(publicProfile(linked.account).hasEmail).toBe(true);
  });

  it("folds the two together when that Discord account already existed here", () => {
    const older = upsertDiscordAccount({ discordId: "222", username: "tom" });
    const newer = signInByEmail("tom@example.org");
    expect(newer.id).not.toBe(older.id);

    const linked = linkDiscordToAccount(newer.id, { discordId: "222", username: "tom" });
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;

    // The older account wins, and the newer one still resolves to it.
    expect(linked.account.id).toBe(older.id);
    expect(linked.account.email).toBe("tom@example.org");
    expect(findAccount(newer.id)?.id).toBe(older.id);
    expect(findAccountByEmail("tom@example.org")?.id).toBe(older.id);
  });

  it("brings Discord roles across, so stewards can confirm events", () => {
    expect(rolesFromDiscord(["Toilet steward 1st floor"])).toContain("steward");
    expect(rolesFromDiscord(["coworker"])).not.toContain("steward");

    const account = signInByEmail("karim@example.org");
    const linked = linkDiscordToAccount(account.id, {
      discordId: "333",
      username: "karim",
      roleNames: ["Note taker steward"],
    });
    expect(linked.ok && publicProfile(linked.account).isSteward).toBe(true);
  });
});

describe("adding an email to a Discord account", () => {
  it("needs the code, and then links it", () => {
    const account = upsertDiscordAccount({ discordId: "444", username: "sofie" });
    expect(account.email).toBeNull();

    const wrong = linkEmailToAccount(account.id, {
      email: "sofie@example.org",
      code: "000000",
      sessionPubkey: SESSION,
    });
    expect(wrong.ok).toBe(false);

    const { code } = startEmailLogin({ email: "sofie@example.org", sessionPubkey: SESSION });
    const linked = linkEmailToAccount(account.id, {
      email: "sofie@example.org",
      code,
      sessionPubkey: SESSION,
    });

    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.account.email).toBe("sofie@example.org");
    expect(linked.account.discordId).toBe("444");
  });

  it("folds in an account that already used that address", () => {
    const emailAccount = signInByEmail("rita@example.org");
    const discordAccount = upsertDiscordAccount({ discordId: "555", username: "rita" });

    const { code } = startEmailLogin({ email: "rita@example.org", sessionPubkey: SESSION });
    const linked = linkEmailToAccount(discordAccount.id, {
      email: "rita@example.org",
      code,
      sessionPubkey: SESSION,
    });

    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.account.id).toBe(emailAccount.id);
    expect(linked.account.discordId).toBe("555");
    expect(findAccount(discordAccount.id)?.id).toBe(emailAccount.id);
  });
});

describe("signing in again after linking", () => {
  it("lands on the same account whichever door is used", () => {
    const account = signInByEmail("wout@example.org");
    linkDiscordToAccount(account.id, { discordId: "666", username: "wout" });

    const throughDiscord = upsertDiscordAccount({ discordId: "666", username: "wout" });
    const throughEmail = signInByEmail("wout@example.org");

    expect(throughDiscord.id).toBe(account.id);
    expect(throughEmail.id).toBe(account.id);
  });
});

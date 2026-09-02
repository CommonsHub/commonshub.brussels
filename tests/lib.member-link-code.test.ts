import { describe, expect, test, afterEach, jest } from "@jest/globals";

const ACCOUNT = "discord:user:123456789012345678";
const TARGET = `email:sha256:${"a".repeat(64)}`;

function load(secret: string | undefined) {
  if (secret === undefined) {
    delete process.env.MEMBER_LINK_SECRET;
  } else {
    process.env.MEMBER_LINK_SECRET = secret;
  }
  let mod: typeof import("@/lib/member-link-code");
  jest.isolateModules(() => {
    mod = require("@/lib/member-link-code");
  });
  return mod!;
}

describe("membership link codes", () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("a code verifies for the pair it was issued for", () => {
    const { issueLinkCode, verifyLinkCode } = load("test-secret");
    const code = issueLinkCode(ACCOUNT, TARGET)!;
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyLinkCode(ACCOUNT, TARGET, code)).toBe(true);
  });

  // The code binds the account to the address. Without that, a code mailed to
  // one member could be replayed by a different signed-in account.
  test("a code issued for one account does not verify for another", () => {
    const { issueLinkCode, verifyLinkCode } = load("test-secret");
    const code = issueLinkCode(ACCOUNT, TARGET)!;
    expect(verifyLinkCode("discord:user:999", TARGET, code)).toBe(false);
  });

  test("a code issued for one address does not verify for another", () => {
    const { issueLinkCode, verifyLinkCode } = load("test-secret");
    const code = issueLinkCode(ACCOUNT, TARGET)!;
    expect(verifyLinkCode(ACCOUNT, `email:sha256:${"b".repeat(64)}`, code)).toBe(false);
  });

  test("a code from the previous window still verifies, one from two windows ago does not", () => {
    const { issueLinkCode, verifyLinkCode } = load("test-secret");
    const now = 1_800_000_000_000;
    const oneWindow = 15 * 60 * 1000;

    const code = issueLinkCode(ACCOUNT, TARGET, now)!;
    expect(verifyLinkCode(ACCOUNT, TARGET, code, now + oneWindow)).toBe(true);
    expect(verifyLinkCode(ACCOUNT, TARGET, code, now + 2 * oneWindow + 1)).toBe(false);
  });

  test("rejects anything that is not six digits", () => {
    const { verifyLinkCode } = load("test-secret");
    for (const bad of ["", "12345", "1234567", "abcdef", "12 345", "  ", "000000000"]) {
      expect(verifyLinkCode(ACCOUNT, TARGET, bad)).toBe(false);
    }
  });

  test("without a secret the flow is off, and no code verifies", () => {
    const { linkingEnabled, issueLinkCode, verifyLinkCode } = load(undefined);
    expect(linkingEnabled()).toBe(false);
    expect(issueLinkCode(ACCOUNT, TARGET)).toBeNull();
    expect(verifyLinkCode(ACCOUNT, TARGET, "123456")).toBe(false);
  });

  test("a different secret produces a different code", () => {
    const first = load("secret-one").issueLinkCode(ACCOUNT, TARGET, 1_800_000_000_000);
    const second = load("secret-two").issueLinkCode(ACCOUNT, TARGET, 1_800_000_000_000);
    expect(second).not.toBe(first);
  });
});

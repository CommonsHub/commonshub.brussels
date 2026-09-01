import { createHash } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const SALT = "prod-testsalt";

/**
 * membership.ts reads DATA_DIR through @/lib/data-paths, which resolves it at
 * module load. Each test therefore points DATA_DIR at a temp tree and imports
 * the module fresh.
 */
function loadMembership(dataDir: string, salt: string | undefined) {
  process.env.DATA_DIR = dataDir;
  if (salt === undefined) {
    delete process.env.EMAIL_HASH_SALT;
  } else {
    process.env.EMAIL_HASH_SALT = salt;
  }
  let mod: typeof import("@/lib/membership");
  jest.isolateModules(() => {
    mod = require("@/lib/membership");
  });
  return mod!;
}

function writeHistory(dataDir: string, memberId: string, body: object) {
  const dir = path.join(dataDir, "latest", "generated", "restricted", "members");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${memberId}.json`), JSON.stringify(body));
}

describe("membership identity", () => {
  let dataDir: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "membership-"));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
    process.env = { ...originalEnv };
  });

  it("hashes an email the same way chb does", () => {
    const { memberIdForEmail } = loadMembership(dataDir, SALT);
    // chb: sha256(lowercase(trim(email)) + salt)
    const expected = createHash("sha256").update("ada@example.org" + SALT).digest("hex");
    expect(memberIdForEmail("ada@example.org")).toBe(expected);
  });

  it("normalises case and surrounding whitespace, as chb does", () => {
    const { memberIdForEmail } = loadMembership(dataDir, SALT);
    const canonical = memberIdForEmail("ada@example.org");
    expect(memberIdForEmail("  Ada@Example.ORG  ")).toBe(canonical);
  });

  it("is disabled, and identifies nobody, without a salt", () => {
    const { membershipEnabled, memberIdForEmail } = loadMembership(dataDir, undefined);
    expect(membershipEnabled()).toBe(false);
    expect(memberIdForEmail("ada@example.org")).toBeNull();
  });

  it("treats a blank salt as no salt", () => {
    const { membershipEnabled } = loadMembership(dataDir, "   ");
    expect(membershipEnabled()).toBe(false);
  });

  it("has no id for an account without an email address", () => {
    const { memberIdForEmail } = loadMembership(dataDir, SALT);
    expect(memberIdForEmail(null)).toBeNull();
    expect(memberIdForEmail(undefined)).toBeNull();
    expect(memberIdForEmail("   ")).toBeNull();
  });

  it("reads a member's history", () => {
    const { memberIdForEmail, readMemberHistory } = loadMembership(dataDir, SALT);
    const id = memberIdForEmail("ada@example.org")!;
    writeHistory(dataDir, id, { schemaVersion: 1, memberId: id, monthsActive: 2, months: [] });

    expect(readMemberHistory(id)).toMatchObject({ memberId: id, monthsActive: 2 });
  });

  it("returns nothing for a member that does not exist", () => {
    const { readMemberHistory } = loadMembership(dataDir, SALT);
    expect(readMemberHistory("a".repeat(64))).toBeNull();
  });

  it("serves no history at all without a salt, even for a file that exists", () => {
    const withSalt = loadMembership(dataDir, SALT);
    const id = withSalt.memberIdForEmail("ada@example.org")!;
    writeHistory(dataDir, id, { schemaVersion: 1, memberId: id, monthsActive: 1, months: [] });

    const withoutSalt = loadMembership(dataDir, undefined);
    expect(withoutSalt.readMemberHistory(id)).toBeNull();
  });

  it("refuses ids that are not a bare digest, so none can escape the directory", () => {
    const { memberHistoryPath, readMemberHistory } = loadMembership(dataDir, SALT);
    const bad = [
      "",
      "not-a-hash",
      "../../../../etc/passwd",
      "a".repeat(63),
      "a".repeat(65),
      "z".repeat(64),
      `${"a".repeat(64)}/../../secret`,
      `${"a".repeat(64)}.json`,
    ];
    for (const id of bad) {
      expect(memberHistoryPath(id)).toBeNull();
      expect(readMemberHistory(id)).toBeNull();
    }
  });

  it("resolves a valid id inside the restricted members directory", () => {
    const { memberHistoryPath } = loadMembership(dataDir, SALT);
    const id = "b".repeat(64);
    const file = memberHistoryPath(id)!;
    expect(path.dirname(file)).toBe(
      path.join(dataDir, "latest", "generated", "restricted", "members")
    );
    expect(path.basename(file)).toBe(`${id}.json`);
  });

  it("never reads from the private tree", () => {
    const { memberHistoryPath, readMemberHistory } = loadMembership(dataDir, SALT);
    const id = "b".repeat(64);

    // Nothing this app serves may come from private/. Prove the resolved path
    // does not go there, and that a private copy of the same id is not read.
    expect(memberHistoryPath(id)).not.toContain(`${path.sep}private${path.sep}`);

    const privateDir = path.join(dataDir, "latest", "generated", "private", "members");
    fs.mkdirSync(privateDir, { recursive: true });
    fs.writeFileSync(
      path.join(privateDir, `${id}.json`),
      JSON.stringify({ schemaVersion: 1, memberId: id, monthsActive: 99, months: [] })
    );

    expect(readMemberHistory(id)).toBeNull();
  });

  it("refuses a path that would land under private, whatever DATA_DIR says", () => {
    // A DATA_DIR that itself contains a private segment must not smuggle
    // member reads into the never-served tree.
    const sneaky = path.join(dataDir, "private");
    fs.mkdirSync(sneaky, { recursive: true });
    const { memberHistoryPath } = loadMembership(sneaky, SALT);
    expect(memberHistoryPath("b".repeat(64))).toBeNull();
  });

  it("picks up a salt change without a rebuild, so a restart is enough", () => {
    const first = loadMembership(dataDir, SALT).memberIdForEmail("ada@example.org");
    const second = loadMembership(dataDir, "prod-different").memberIdForEmail("ada@example.org");
    expect(second).not.toBe(first);
  });
});

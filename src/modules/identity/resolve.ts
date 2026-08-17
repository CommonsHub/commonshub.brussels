/** Small lookup used by test tooling: an account by its display name. */
import * as fs from "fs";
import * as path from "path";
import { identityDir } from "./crypto";
import type { Account } from "./store";

export function listAccountByName(name: string): Account | null {
  try {
    const file = path.join(identityDir(), "identity.json");
    if (!fs.existsSync(file)) return null;
    const db = JSON.parse(fs.readFileSync(file, "utf-8")) as { accounts?: Account[] };
    const needle = name.trim().toLowerCase();
    return (
      (db.accounts ?? []).find(
        (a) => !a.mergedInto && a.displayName.trim().toLowerCase() === needle,
      ) ?? null
    );
  } catch {
    return null;
  }
}

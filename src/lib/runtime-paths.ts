import fs from "fs";
import os from "os";
import path from "path";

/**
 * Where the website is allowed to write.
 *
 * `DATA_DIR` is the dataset the chb pipeline generates and is mounted
 * read-only in production. It is a bind mount, so anything the container
 * writes there — including ownership changes — lands on the host and takes the
 * dataset away from the user that generates it.
 *
 * Everything the site needs to write therefore goes under `RUNTIME_DIR`, which
 * defaults to a directory in the OS temp dir.
 *
 * Note that the default is **ephemeral**: `/tmp` is cleared on restart, and is
 * a tmpfs in the production container. That is the right trade-off for caches,
 * which simply repopulate. Anything that must survive a restart needs
 * `RUNTIME_DIR` pointed at a writable volume.
 */
function resolveRuntimeDir(): string {
  const raw = process.env.RUNTIME_DIR;
  if (raw && raw.trim() !== "") {
    if (raw.startsWith("~/")) {
      return path.join(os.homedir(), raw.slice(2));
    }
    return path.resolve(raw);
  }
  return path.join(os.tmpdir(), "commonshub");
}

export const RUNTIME_DIR = resolveRuntimeDir();

/** Build a path inside RUNTIME_DIR. Does not create anything. */
export function runtimePath(...segments: string[]): string {
  return path.join(RUNTIME_DIR, ...segments);
}

/**
 * Create the directory holding `filePath`, returning false if it cannot be
 * created. Callers use this to degrade to memory-only instead of throwing:
 * every consumer of RUNTIME_DIR is a cache or replaceable state.
 */
export function ensureDirFor(filePath: string): boolean {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    return true;
  } catch (error) {
    console.error(`[runtime] Cannot create directory for ${filePath}:`, error);
    return false;
  }
}

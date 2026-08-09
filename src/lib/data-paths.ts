import * as os from "os";
import * as path from "path";

function resolveDataDir(): string {
  const raw = process.env.DATA_DIR || "/data";
  // Expand ~ to home directory (shell tilde is not expanded by Node.js)
  if (raw.startsWith("~/")) {
    return path.join(os.homedir(), raw.slice(2));
  }
  return raw;
}

export const DATA_DIR = resolveDataDir();

// Data type/provider path segments
export const DISCORD_SUBDIR = path.join("messages", "discord");
export const DISCORD_URL_SEGMENT = "messages/discord";

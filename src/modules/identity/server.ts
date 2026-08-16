import { cookies } from "next/headers";
import { callerFromSessionId, SESSION_COOKIE, type Caller } from "./service";

/** Who is asking, according to the session cookie. */
export async function currentCaller(): Promise<Caller | null> {
  const store = await cookies();
  return callerFromSessionId(store.get(SESSION_COOKIE)?.value);
}

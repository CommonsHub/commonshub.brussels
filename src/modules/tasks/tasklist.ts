/**
 * Shared task lists, wire-compatible with tasklist.sh.
 *
 * What an event needs — a projector, coffee, someone to clean up — is an open
 * list, not a fixed set of checkboxes. We keep it in the same format tasklist.sh
 * uses, so a proposal's list is a normal shared list: `https://tasklist.sh/#<id>`
 * opens it, anyone with the link can add items, claim one, or mark it done, and
 * what they do there shows up here.
 *
 * Format (as implemented by tasklist.sh):
 *   2100  task     content = title
 *   2101  action   tags: e=<task id>, action = claim|unclaim|done|undone|delete
 *   2102  meta     content = list name
 *   2103  comment  tags: e=<task id>, content = text
 * Every event carries `t = <list id>` and `client = tasklist`, plus an optional
 * `name` tag so people show up under a readable name.
 */

import type { Event, Filter } from "nostr-tools";

/**
 * The relay client is loaded on demand: building and reading events is pure
 * data work, and only actually talking to a relay needs the websocket stack.
 */
async function relayPool() {
  const { SimplePool } = await import("nostr-tools/pool");
  return new SimplePool();
}

export const KIND_TASK = 2100;
export const KIND_ACTION = 2101;
export const KIND_META = 2102;
export const KIND_COMMENT = 2103;

/** tasklist.sh's own defaults — using them is what makes the lists portable. */
export const TASKLIST_RELAYS = (
  process.env.TASKLIST_RELAYS ||
  "wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net,wss://offchain.pub"
)
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);

export const TASKLIST_BASE_URL = process.env.TASKLIST_BASE_URL || "https://tasklist.sh";

export { SUGGESTED_NEEDS, MANDATORY_NEEDS, withMandatoryNeeds } from "./needs";
import { withMandatoryNeeds } from "./needs";

export function newListId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function taskListUrl(listId: string): string {
  return `${TASKLIST_BASE_URL}/#${listId}`;
}

// ── reading a list ─────────────────────────────────────────────────────────

export interface TaskState {
  id: string;
  title: string;
  creator: string;
  createdAt: number;
  assignee: string | null;
  assigneeName: string | null;
  done: boolean;
  doneBy: string | null;
  commentCount: number;
}

export interface TaskListSnapshot {
  listId: string;
  name: string | null;
  url: string;
  tasks: TaskState[];
  openCount: number;
  doneCount: number;
  claimedCount: number;
}

function tagValue(event: Event, name: string): string | null {
  const tag = event.tags.find((t) => t[0] === name);
  return tag ? tag[1] ?? null : null;
}

/** Read the current state of a list off the relays. */
export async function fetchTaskList(listId: string): Promise<TaskListSnapshot> {
  const pool = await relayPool();
  const filter: Filter = {
    kinds: [KIND_TASK, KIND_ACTION, KIND_META, KIND_COMMENT],
    "#t": [listId],
    limit: 1000,
  };

  let events: Event[] = [];
  try {
    events = await pool.querySync(TASKLIST_RELAYS, filter, { maxWait: 4000 });
  } catch (error) {
    console.error("[tasklist] could not reach the relays:", error);
  } finally {
    pool.close(TASKLIST_RELAYS);
  }

  return projectTaskList(listId, events);
}

export function projectTaskList(listId: string, events: Event[]): TaskListSnapshot {
  const tasks = new Map<string, { id: string; title: string; creator: string; createdAt: number }>();
  const actions = new Map<
    string,
    Array<{ id: string; pubkey: string; created_at: number; act: string }>
  >();
  const comments = new Map<string, number>();
  const names = new Map<string, string>();
  let listName: string | null = null;
  let listNameAt = 0;

  const seen = new Set<string>();
  for (const event of events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    if (tagValue(event, "t") !== listId) continue;

    const name = tagValue(event, "name");
    if (name) names.set(event.pubkey, name);

    if (event.kind === KIND_TASK) {
      const title = (event.content || "").slice(0, 300).trim();
      if (title) {
        tasks.set(event.id, {
          id: event.id,
          title,
          creator: event.pubkey,
          createdAt: event.created_at,
        });
      }
    } else if (event.kind === KIND_ACTION) {
      const taskId = tagValue(event, "e");
      const act = tagValue(event, "action");
      if (!taskId || !act) continue;
      if (!["claim", "unclaim", "done", "undone", "delete"].includes(act)) continue;
      const list = actions.get(taskId) ?? [];
      list.push({ id: event.id, pubkey: event.pubkey, created_at: event.created_at, act });
      actions.set(taskId, list);
    } else if (event.kind === KIND_COMMENT) {
      const taskId = tagValue(event, "e");
      if (taskId) comments.set(taskId, (comments.get(taskId) ?? 0) + 1);
    } else if (event.kind === KIND_META) {
      const value = (event.content || "").slice(0, 48).trim();
      if (value && event.created_at > listNameAt) {
        listName = value;
        listNameAt = event.created_at;
      }
    }
  }

  const projected: TaskState[] = [];
  for (const task of tasks.values()) {
    const acts = (actions.get(task.id) ?? [])
      .slice()
      .sort((a, b) => a.created_at - b.created_at || (a.id < b.id ? -1 : 1));

    let assignee: string | null = null;
    let done = false;
    let doneBy: string | null = null;
    let deleted = false;

    for (const a of acts) {
      if (a.act === "claim") assignee = a.pubkey;
      else if (a.act === "unclaim" && assignee === a.pubkey) assignee = null;
      else if (a.act === "done") {
        done = true;
        doneBy = a.pubkey;
      } else if (a.act === "undone") done = false;
      else if (a.act === "delete" && a.pubkey === task.creator) deleted = true;
    }

    if (deleted) continue;
    projected.push({
      id: task.id,
      title: task.title,
      creator: task.creator,
      createdAt: task.createdAt,
      assignee,
      assigneeName: assignee ? names.get(assignee) ?? null : null,
      done,
      doneBy,
      commentCount: comments.get(task.id) ?? 0,
    });
  }

  projected.sort((a, b) => a.createdAt - b.createdAt);

  return {
    listId,
    name: listName,
    url: taskListUrl(listId),
    tasks: projected,
    openCount: projected.filter((t) => !t.done).length,
    doneCount: projected.filter((t) => t.done).length,
    claimedCount: projected.filter((t) => !t.done && t.assignee).length,
  };
}

// ── writing to a list ──────────────────────────────────────────────────────

export interface UnsignedTaskEvent {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

/** Signs an event on the author's behalf — see modules/identity. */
export type EventSigner = (event: UnsignedTaskEvent) => Promise<Event>;

function baseTags(listId: string, authorName?: string): string[][] {
  const tags: string[][] = [
    ["t", listId],
    ["client", "tasklist"],
  ];
  if (authorName) tags.push(["name", authorName]);
  return tags;
}

export function buildTaskEvent(
  listId: string,
  title: string,
  authorName?: string,
): UnsignedTaskEvent {
  return {
    kind: KIND_TASK,
    created_at: Math.floor(Date.now() / 1000),
    tags: baseTags(listId, authorName),
    content: title,
  };
}

export function buildListNameEvent(
  listId: string,
  name: string,
  authorName?: string,
): UnsignedTaskEvent {
  return {
    kind: KIND_META,
    created_at: Math.floor(Date.now() / 1000),
    tags: baseTags(listId, authorName),
    content: name.slice(0, 48),
  };
}

export function buildActionEvent(
  listId: string,
  taskId: string,
  action: "claim" | "unclaim" | "done" | "undone" | "delete",
  authorName?: string,
): UnsignedTaskEvent {
  return {
    kind: KIND_ACTION,
    created_at: Math.floor(Date.now() / 1000),
    tags: [...baseTags(listId, authorName), ["e", taskId], ["action", action]],
    content: "",
  };
}

export async function publish(events: Event[]): Promise<void> {
  if (!events.length) return;
  const pool = await relayPool();
  try {
    await Promise.allSettled(events.flatMap((event) => pool.publish(TASKLIST_RELAYS, event)));
  } catch (error) {
    console.error("[tasklist] publish failed:", error);
  } finally {
    pool.close(TASKLIST_RELAYS);
  }
}

/**
 * Create the list for a proposal: name it after the event and seed it with the
 * things the proposer asked for, plus the mandatory ones.
 */
export async function createTaskList(
  options: { name: string; needs: string[]; authorName?: string },
  sign: EventSigner,
): Promise<string> {
  const listId = newListId();
  const items = withMandatoryNeeds(options.needs);

  const events: Event[] = [];
  events.push(await sign(buildListNameEvent(listId, options.name, options.authorName)));
  for (const item of items) {
    events.push(await sign(buildTaskEvent(listId, item, options.authorName)));
  }

  await publish(events);
  return listId;
}

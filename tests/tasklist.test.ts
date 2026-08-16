import {
  buildActionEvent,
  buildTaskEvent,
  projectTaskList,
  taskListUrl,
  KIND_ACTION,
  KIND_META,
  KIND_TASK,
} from "@/modules/tasks/tasklist";
import { withMandatoryNeeds } from "@/modules/tasks/needs";
import type { Event } from "nostr-tools";

const LIST = "a1b2c3d4e5f60718";

/** Minimal stand-in for a signed event — the projection never checks signatures. */
function event(partial: Partial<Event> & { kind: number; id: string; pubkey: string }): Event {
  return {
    created_at: 1_000,
    tags: [["t", LIST]],
    content: "",
    sig: "",
    ...partial,
  } as Event;
}

describe("shared task lists", () => {
  it("links out to tasklist.sh with the list id in the fragment", () => {
    expect(taskListUrl(LIST)).toBe(`https://tasklist.sh/#${LIST}`);
  });

  it("always adds the mandatory items", () => {
    expect(withMandatoryNeeds(["Coffee"])).toEqual(["Coffee", "Cleaning"]);
    // …and does not add them twice.
    expect(withMandatoryNeeds(["cleaning"])).toEqual(["cleaning"]);
  });

  it("tags every event with the list id and the client, as tasklist.sh does", () => {
    const task = buildTaskEvent(LIST, "Bring the projector", "Ana");
    expect(task.kind).toBe(KIND_TASK);
    expect(task.content).toBe("Bring the projector");
    expect(task.tags).toEqual(
      expect.arrayContaining([
        ["t", LIST],
        ["client", "tasklist"],
        ["name", "Ana"],
      ]),
    );

    const action = buildActionEvent(LIST, "task-1", "claim", "Sofie");
    expect(action.kind).toBe(KIND_ACTION);
    expect(action.tags).toEqual(
      expect.arrayContaining([
        ["e", "task-1"],
        ["action", "claim"],
      ]),
    );
  });

  it("reads claims and completions the way tasklist.sh resolves them", () => {
    const snapshot = projectTaskList(LIST, [
      event({ kind: KIND_META, id: "m", pubkey: "hub", content: "Repair café" }),
      event({ kind: KIND_TASK, id: "t1", pubkey: "ana", content: "Coffee" }),
      event({ kind: KIND_TASK, id: "t2", pubkey: "ana", content: "Cleaning" }),
      event({
        kind: KIND_ACTION,
        id: "a1",
        pubkey: "sofie",
        created_at: 1_100,
        tags: [["t", LIST], ["e", "t1"], ["action", "claim"], ["name", "Sofie"]],
      }),
      event({
        kind: KIND_ACTION,
        id: "a2",
        pubkey: "sofie",
        created_at: 1_200,
        tags: [["t", LIST], ["e", "t2"], ["action", "done"]],
      }),
    ]);

    expect(snapshot.name).toBe("Repair café");
    const coffee = snapshot.tasks.find((t) => t.title === "Coffee");
    expect(coffee?.assignee).toBe("sofie");
    expect(coffee?.assigneeName).toBe("Sofie");
    expect(snapshot.tasks.find((t) => t.title === "Cleaning")?.done).toBe(true);
    expect(snapshot.openCount).toBe(1);
    expect(snapshot.claimedCount).toBe(1);
    expect(snapshot.doneCount).toBe(1);
  });

  it("lets someone drop a task they claimed, but not one they did not", () => {
    const base = [
      event({ kind: KIND_TASK, id: "t1", pubkey: "ana", content: "Water" }),
      event({
        kind: KIND_ACTION,
        id: "a1",
        pubkey: "sofie",
        created_at: 1_100,
        tags: [["t", LIST], ["e", "t1"], ["action", "claim"]],
      }),
    ];

    const droppedBySomeoneElse = projectTaskList(LIST, [
      ...base,
      event({
        kind: KIND_ACTION,
        id: "a2",
        pubkey: "tom",
        created_at: 1_200,
        tags: [["t", LIST], ["e", "t1"], ["action", "unclaim"]],
      }),
    ]);
    expect(droppedBySomeoneElse.tasks[0].assignee).toBe("sofie");

    const droppedByOwner = projectTaskList(LIST, [
      ...base,
      event({
        kind: KIND_ACTION,
        id: "a3",
        pubkey: "sofie",
        created_at: 1_300,
        tags: [["t", LIST], ["e", "t1"], ["action", "unclaim"]],
      }),
    ]);
    expect(droppedByOwner.tasks[0].assignee).toBeNull();
  });

  it("ignores events belonging to another list", () => {
    const snapshot = projectTaskList(LIST, [
      event({ kind: KIND_TASK, id: "t1", pubkey: "ana", content: "Ours" }),
      event({
        kind: KIND_TASK,
        id: "t2",
        pubkey: "ana",
        content: "Someone else's",
        tags: [["t", "ffffffffffffffff"]],
      }),
    ]);
    expect(snapshot.tasks.map((t) => t.title)).toEqual(["Ours"]);
  });
});

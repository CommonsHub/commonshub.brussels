import type { ProposalStatus } from "@/modules/proposals/types";

/** One word for each state, used the same way on every screen. */
export function statusLabel(status: ProposalStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "open":
      return "Collecting support";
    case "funded":
      return "Funded";
    case "confirmed":
      return "Confirmed";
    case "happened":
      return "Happened";
    case "declined":
      return "Declined";
    case "cancelled":
      return "Cancelled";
  }
}

export function statusTone(
  status: ProposalStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "confirmed":
      return "default";
    case "funded":
      return "default";
    case "declined":
    case "cancelled":
      return "destructive";
    case "happened":
      return "secondary";
    default:
      return "outline";
  }
}

const STEPS: Array<{ status: ProposalStatus; label: string }> = [
  { status: "open", label: "Proposed" },
  { status: "funded", label: "Room covered" },
  { status: "confirmed", label: "On the calendar" },
  { status: "happened", label: "Happened" },
];

export function StatusSteps({ status }: { status: ProposalStatus }) {
  const currentIndex = STEPS.findIndex((s) => s.status === status);

  return (
    <ol className="space-y-2">
      {STEPS.map((step, index) => {
        const done = currentIndex >= 0 && index < currentIndex;
        const now = index === currentIndex;
        return (
          <li key={step.status} className="flex items-center gap-2 text-sm">
            <span
              className={`w-2.5 h-2.5 rounded-full border ${
                now ? "bg-primary border-primary" : done ? "border-primary" : "border-muted-foreground/40"
              }`}
              aria-hidden
            />
            <span className={now ? "font-medium" : "text-muted-foreground"}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

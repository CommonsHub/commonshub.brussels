import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface ChecklistItem {
  key: string;
  done: boolean;
  title: string;
  detail?: React.ReactNode;
  /** Shown on the right (desktop) or under the detail (mobile) while not done. */
  action?: React.ReactNode;
}

function StateDot({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
        <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="w-6 h-6 rounded-full border-2 border-dashed border-border shrink-0 mt-0.5" />
  );
}

/**
 * The proposal, as the list of what it still needs. Every row that is not
 * ticked carries the way to tick it — the page's ask is the list itself.
 */
export function Checklist({ items, footer }: { items: ChecklistItem[]; footer?: React.ReactNode }) {
  const inPlace = items.filter((item) => item.done).length;
  const percent = items.length === 0 ? 0 : Math.round((inPlace / items.length) * 100);

  return (
    <Card className="overflow-hidden py-0 gap-0">
      <div className="bg-primary/5 border-b px-5 py-4 space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">What it needs to happen</h2>
          <span className="text-sm font-medium text-primary tabular-nums whitespace-nowrap">
            {inPlace} of {items.length} in place
          </span>
        </div>
        <Progress value={percent} className="h-2 bg-background" />
      </div>

      <ul className="divide-y">
        {items.map((item) => (
          <li key={item.key} className="px-5 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <StateDot done={item.done} />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold leading-6">{item.title}</p>
                  {item.detail && (
                    <div className="text-sm text-muted-foreground">{item.detail}</div>
                  )}
                </div>
              </div>
              {item.action && (
                <div className="shrink-0 pl-[38px] sm:pl-0 sm:max-w-[240px] w-full sm:w-auto">
                  {item.action}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {footer && (
        <div className="border-t bg-muted/40 px-5 py-3 text-xs text-muted-foreground space-y-1">
          {footer}
        </div>
      )}
    </Card>
  );
}

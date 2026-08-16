import { Progress } from "@/components/ui/progress";
import { formatEur, formatTokens, type FundingProgress } from "@/modules/proposals/funding";

/**
 * What the hub needs for this event, and how far the contributions have got.
 * Both currencies count towards the same target, so the bar is the mix.
 */
export function FundingMeter({
  funding,
  compact = false,
}: {
  funding: FundingProgress;
  compact?: boolean;
}) {
  const percent = Math.min(100, Math.round(funding.coverage * 100));
  const { target } = funding;

  if (compact) {
    return (
      <div className="space-y-1">
        <Progress value={percent} className="h-1.5" />
        <p className="text-xs text-muted-foreground">
          {funding.funded ? (
            <span className="text-primary font-medium">Fully funded</span>
          ) : (
            <>
              {percent}% funded — {formatEur(funding.remainingEur)} or{" "}
              {formatTokens(funding.remainingTokens)} to go
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-semibold">Funding</h3>
        <span className="text-sm text-muted-foreground tabular-nums">{percent}%</span>
      </div>

      <Progress value={percent} className="h-2" />

      <div className="text-sm space-y-1">
        <p>
          <span className="font-medium">
            {formatEur(funding.raisedEur)}
            {funding.raisedTokens > 0 && <> + {formatTokens(funding.raisedTokens)}</>}
          </span>{" "}
          <span className="text-muted-foreground">
            of {formatEur(target.eur)} or {formatTokens(target.tokens)}
          </span>
        </p>

        {funding.funded ? (
          <p className="text-primary font-medium">
            Funded — a steward can put it on the calendar.
          </p>
        ) : (
          <p className="text-muted-foreground">
            Still needed: {formatEur(funding.remainingEur)}, or{" "}
            {formatTokens(funding.remainingTokens)}, or any mix of the two.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {target.roomName ? (
            <>
              {target.hours}h in the {target.roomName}
              {target.estimated && " (estimated — no room picked yet)"}
            </>
          ) : (
            "No room picked yet."
          )}
          {funding.contributorCount > 0 && (
            <>
              {" · "}
              {funding.contributorCount} {funding.contributorCount === 1 ? "person has" : "people have"}{" "}
              chipped in
            </>
          )}
        </p>
      </div>
    </div>
  );
}

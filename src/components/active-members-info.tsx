"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ActiveMembersInfo() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="What counts as an active member?"
            className="inline-flex items-center text-muted-foreground/70 hover:text-foreground"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          A member is counted as active if they posted in any Discord channel
          this period, or were mentioned in someone else&apos;s message.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

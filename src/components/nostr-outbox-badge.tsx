"use client";

import { Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNostr } from "@/components/nostr-provider";

export function NostrOutboxBadge() {
  const { outboxCount, sync, ready } = useNostr();
  if (!ready) return null;
  if (outboxCount === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            onClick={() => sync()}
            aria-label="Sync nostr outbox"
          >
            <Inbox className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center px-1">
              {outboxCount}
            </span>
            <RefreshCw className="sr-only" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {outboxCount} event{outboxCount === 1 ? "" : "s"} pending — click to retry
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

import Image from "@/components/optimized-image";
import { Calendar, MapPin, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Event {
  id: string;
  name: string;
  description?: string;
  startAt: string;
  endAt?: string;
  timezone?: string;
  location?: string;
  url?: string;
  coverImage?: string;
  source: "luma" | "ical";
}

interface EventsListProps {
  events: Event[];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}



export function EventsList({ events }: EventsListProps) {
  return (
    <div className="space-y-4">
      {events.map((event) => {
        const startDate = new Date(event.startAt);
        const endDate = event.endAt ? new Date(event.endAt) : null;

        return (
          <Card key={event.id} className="overflow-hidden">
            <div className="flex flex-col md:flex-row">
              {/* Event Image */}
              {event.coverImage && (
                <div className="relative w-full md:w-64 h-48 md:h-auto flex-shrink-0">
                  <Image
                    src={event.coverImage}
                    alt={event.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}

              {/* Event Details */}
              <div className="flex-1 p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xl font-semibold">{event.name}</h3>
                      {event.source === "luma" && (
                        <Badge variant="secondary" className="text-xs">Luma</Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(event.startAt)}</span>
                        {endDate && (
                          <>
                            <span>-</span>
                            <span>{formatDate(event.endAt!)}</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span>{formatTime(event.startAt)}</span>
                        {endDate && (
                          <>
                            <span>-</span>
                            <span>{formatTime(event.endAt!)}</span>
                          </>
                        )}
                      </div>

                      {event.location && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate max-w-xs">{event.location}</span>
                        </div>
                      )}
                    </div>

                    {event.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {event.url && (
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        View event details
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

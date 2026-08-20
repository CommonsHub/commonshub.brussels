import { notFound } from "next/navigation";
import * as fs from "fs";
import * as path from "path";
import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, Users, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EventsList } from "@/components/events-list";

interface PageProps {
  params: Promise<{
    year: string;
    month: string;
  }>;
}

interface EventMetadata {
  attendance?: number;
  fridgeIncome?: number;
  rentalIncome?: number;
  note?: string;
}

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
  lumaData?: any;
  metadata: EventMetadata;
}

interface EventsFile {
  month: string;
  generatedAt: string;
  events: Event[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Load events for a specific month
 */
async function loadEvents(year: string, month: string): Promise<Event[]> {
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const filePath = path.join(dataDir, year, month, "events.json");

  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const data: EventsFile = JSON.parse(fileContent);
    return data.events || [];
  } catch (error) {
    console.error(`Error reading events file:`, error);
    return [];
  }
}

export default async function EventsPage({ params }: PageProps) {
  const { year, month } = await params;

  // Validate params
  if (!/^\d{4}$/.test(year) || !/^(0[1-9]|1[0-2])$/.test(month)) {
    notFound();
  }

  const events = await loadEvents(year, month);
  const monthName = MONTH_NAMES[parseInt(month, 10) - 1];

  const totalEvents = events.length;

  return (
    <div className="container mx-auto py-12 px-4 space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href={`/${year}/${month}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {monthName} {year} Report
        </Link>
        <div>
          <h1 className="text-4xl font-bold">{monthName} {year} Events</h1>
          <p className="text-muted-foreground">
            All events hosted in {monthName} {year}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{totalEvents}</span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Events List */}
      {events.length > 0 ? (
        <EventsList events={events} />
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No events found for this month
          </CardContent>
        </Card>
      )}
    </div>
  );
}

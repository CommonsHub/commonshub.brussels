"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface EventMetadata {
  host?: string;
  attendance?: number;
  ticketRevenue?: number;
  fridgeIncome?: number;
  rentalIncome?: number;
  ticketsSold?: number;
  note?: string;
}

interface Event {
  id: string;
  name: string;
  startAt: string;
  endAt?: string;
  metadata: EventMetadata;
  source: string;
}

interface MonthEvents {
  month: string;
  events: Event[];
}

export default function YearEventsPage() {
  const params = useParams();
  const year = params.year as string;
  const { data: session } = useSession();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingEvents, setSavingEvents] = useState<Set<string>>(new Set());
  const [saveTimeouts, setSaveTimeouts] = useState<Map<string, NodeJS.Timeout>>(new Map());
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [filterText, setFilterText] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Check if user is admin
  const isAdmin = session?.user?.roleDetails?.some(
    role => role.name.toLowerCase() === "admin" || role.name.toLowerCase() === "administrator"
  ) ?? false;

  // Filter events based on name
  const filteredEvents = events.filter(event =>
    event.name.toLowerCase().includes(filterText.toLowerCase())
  );

  // Initialize filter from URL on mount
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam) {
      setFilterText(filterParam);
      setShowFilter(true);
    }
  }, [searchParams]);

  useEffect(() => {
    loadEvents();
  }, [year]);

  async function loadEvents() {
    try {
      setLoading(true);
      // Load all months for this year
      const months = [
        "01", "02", "03", "04", "05", "06",
        "07", "08", "09", "10", "11", "12"
      ];

      const allEvents: Event[] = [];

      for (const month of months) {
        try {
          const response = await fetch(`/api/events/months/${year}/${month}`);
          if (response.ok) {
            const data: MonthEvents = await response.json();
            allEvents.push(...data.events);
          }
        } catch (error) {
          // Month doesn't exist, continue
        }
      }

      // Sort by date
      allEvents.sort((a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      );

      setEvents(allEvents);
    } catch (error) {
      console.error("Error loading events:", error);
    } finally {
      setLoading(false);
    }
  }

  function updateFilterInURL(newFilter: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (newFilter) {
      params.set('filter', newFilter);
    } else {
      params.delete('filter');
    }
    router.push(`?${params.toString()}`, { scroll: false });
  }

  async function saveEvent(eventId: string, eventData: Event) {
    try {
      // Mark as saving
      setSavingEvents(prev => new Set(prev).add(eventId));

      // Get year and month from event start date
      const date = new Date(eventData.startAt);
      const y = date.getFullYear().toString();
      const m = String(date.getMonth() + 1).padStart(2, "0");

      // Save only this event
      await fetch("/api/events/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: y,
          month: m,
          events: [{
            id: eventData.id,
            metadata: eventData.metadata
          }]
        })
      });

      setLastSaved(new Date());
    } catch (error) {
      console.error("Error saving event:", error);
    } finally {
      // Remove from saving set
      setSavingEvents(prev => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  }

  function updateEventMetadata(eventId: string, field: keyof EventMetadata, value: any) {
    // Format decimal values to 2 places
    if (field === "ticketRevenue" || field === "fridgeIncome" || field === "rentalIncome") {
      if (value !== "" && value !== undefined) {
        value = Math.round(parseFloat(value) * 100) / 100;
      }
    }

    // Create the updated event
    let updatedEvent: Event | undefined;

    setEvents(prevEvents => prevEvents.map(event => {
      if (event.id === eventId) {
        updatedEvent = {
          ...event,
          metadata: {
            ...event.metadata,
            [field]: value === "" ? undefined : value
          }
        };
        return updatedEvent;
      }
      return event;
    }));

    // Clear existing timeout for this event
    const existingTimeout = saveTimeouts.get(eventId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Trigger autosave after 1 second of no changes for this event
    const timeout = setTimeout(() => {
      if (updatedEvent) {
        saveEvent(eventId, updatedEvent);
      }
      // Clean up timeout from map
      setSaveTimeouts(prev => {
        const next = new Map(prev);
        next.delete(eventId);
        return next;
      });
    }, 1000);

    setSaveTimeouts(prev => new Map(prev).set(eventId, timeout));
  }

  function downloadCSV() {
    const headers = [
      "Date",
      "Event Name",
      "Host",
      "Attendance",
      "Tickets Income (EUR)",
      "Fridge (EUR)",
      "Rental (EUR)"
    ];

    const rows = filteredEvents.map(event => {
      const date = new Date(event.startAt).toLocaleDateString("en-GB");
      return [
        date,
        event.name,
        event.metadata.host || "",
        event.metadata.attendance || "",
        event.metadata.ticketRevenue || "",
        event.metadata.fridgeIncome || "",
        event.metadata.rentalIncome || ""
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row =>
        row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `events-${year}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Events {year}</h1>
          <div className="text-sm text-gray-500 mt-1">
            {savingEvents.size > 0 ? (
              <span className="text-blue-600">Saving changes...</span>
            ) : lastSaved ? (
              <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
            ) : (
              <span>Changes autosave after 1 second</span>
            )}
          </div>
        </div>
        <button
          onClick={downloadCSV}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
        >
          Download CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border-b text-left">Date</th>
              <th className="px-4 py-2 border-b text-left">
                <div className="flex items-center gap-2">
                  <span>Event Name</span>
                  <button
                    onClick={() => setShowFilter(!showFilter)}
                    className="text-gray-600 hover:text-gray-900"
                    title="Filter events"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                {showFilter && (
                  <input
                    type="text"
                    value={filterText}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setFilterText(newValue);
                      updateFilterInURL(newValue);
                    }}
                    placeholder="Filter by name..."
                    className="mt-2 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                )}
              </th>
              <th className="px-4 py-2 border-b text-left">Host</th>
              <th className="px-4 py-2 border-b text-right">Attendance</th>
              <th className="px-4 py-2 border-b text-right">Tickets (EUR)</th>
              <th className="px-4 py-2 border-b text-right">Fridge (EUR)</th>
              <th className="px-4 py-2 border-b text-right">Rental (EUR)</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((event) => {
              const date = new Date(event.startAt);
              const dateStr = date.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
              });

              return (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b whitespace-nowrap">
                    {dateStr}
                  </td>
                  <td className="px-4 py-2 border-b">
                    <Link
                      href={`/${year}/${String(date.getMonth() + 1).padStart(2, "0")}#${event.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {event.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 border-b">
                    {isAdmin ? (
                      <input
                        type="text"
                        value={event.metadata.host || ""}
                        onChange={(e) => updateEventMetadata(event.id, "host", e.target.value)}
                        className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Host name"
                      />
                    ) : (
                      <span>{event.metadata.host || "-"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 border-b text-right">
                    {isAdmin ? (
                      <input
                        type="number"
                        value={event.metadata.attendance ?? ""}
                        onChange={(e) => updateEventMetadata(event.id, "attendance", e.target.value ? parseInt(e.target.value) : undefined)}
                        className="w-20 px-2 py-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0"
                      />
                    ) : (
                      <span>{event.metadata.attendance ?? "-"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 border-b text-right">
                    {isAdmin ? (
                      <input
                        type="number"
                        step="0.01"
                        value={event.metadata.ticketRevenue !== undefined ? event.metadata.ticketRevenue.toFixed(2) : ""}
                        onChange={(e) => updateEventMetadata(event.id, "ticketRevenue", e.target.value ? parseFloat(e.target.value) : undefined)}
                        onBlur={(e) => {
                          if (e.target.value && event.metadata.ticketRevenue !== undefined) {
                            e.target.value = event.metadata.ticketRevenue.toFixed(2);
                          }
                        }}
                        className="w-24 px-2 py-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    ) : (
                      <span>{event.metadata.ticketRevenue !== undefined ? event.metadata.ticketRevenue.toFixed(2) : "-"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 border-b text-right">
                    {isAdmin ? (
                      <input
                        type="number"
                        step="0.01"
                        value={event.metadata.fridgeIncome !== undefined ? event.metadata.fridgeIncome.toFixed(2) : ""}
                        onChange={(e) => updateEventMetadata(event.id, "fridgeIncome", e.target.value ? parseFloat(e.target.value) : undefined)}
                        onBlur={(e) => {
                          if (e.target.value && event.metadata.fridgeIncome !== undefined) {
                            e.target.value = event.metadata.fridgeIncome.toFixed(2);
                          }
                        }}
                        className="w-24 px-2 py-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    ) : (
                      <span>{event.metadata.fridgeIncome !== undefined ? event.metadata.fridgeIncome.toFixed(2) : "-"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 border-b text-right">
                    {isAdmin ? (
                      <input
                        type="number"
                        step="0.01"
                        value={event.metadata.rentalIncome !== undefined ? event.metadata.rentalIncome.toFixed(2) : ""}
                        onChange={(e) => updateEventMetadata(event.id, "rentalIncome", e.target.value ? parseFloat(e.target.value) : undefined)}
                        onBlur={(e) => {
                          if (e.target.value && event.metadata.rentalIncome !== undefined) {
                            e.target.value = event.metadata.rentalIncome.toFixed(2);
                          }
                        }}
                        className="w-24 px-2 py-1 border rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    ) : (
                      <span>{event.metadata.rentalIncome !== undefined ? event.metadata.rentalIncome.toFixed(2) : "-"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td className="px-4 py-2 border-t" colSpan={3}>Total</td>
              <td className="px-4 py-2 border-t text-right">
                {filteredEvents.reduce((sum, e) => sum + (e.metadata.attendance || 0), 0)}
              </td>
              <td className="px-4 py-2 border-t text-right">
                {filteredEvents.reduce((sum, e) => sum + (e.metadata.ticketRevenue || 0), 0).toFixed(2)}
              </td>
              <td className="px-4 py-2 border-t text-right">
                {filteredEvents.reduce((sum, e) => sum + (e.metadata.fridgeIncome || 0), 0).toFixed(2)}
              </td>
              <td className="px-4 py-2 border-t text-right">
                {filteredEvents.reduce((sum, e) => sum + (e.metadata.rentalIncome || 0), 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {events.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No events found for {year}
        </div>
      )}
    </div>
  );
}

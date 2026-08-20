"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

interface Event {
  id: string;
  name: string;
  startAt: string;
  endAt?: string;
  source: string;
}

interface MonthEvents {
  month: string;
  events: Event[];
}

export default function YearEventsPage() {
  const params = useParams();
  const year = params.year as string;
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

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

  function downloadCSV() {
    const headers = ["Date", "Event Name"];

    const rows = filteredEvents.map(event => {
      const date = new Date(event.startAt).toLocaleDateString("en-GB");
      return [date, event.name];
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
                </tr>
              );
            })}
          </tbody>
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

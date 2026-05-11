import type { MetadataRoute } from "next";
import roomsData from "@/settings/rooms.json";

const BASE_URL = "https://commonshub.brussels";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/rooms`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/members`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/economy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/finance`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/workshops`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/apply`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    // LLM-friendly markdown pages
    {
      url: `${BASE_URL}/llms.txt`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/about.md`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/events.md`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/rooms.md`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/sitemap.md`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/DATA.md`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    // Members list
    {
      url: `${BASE_URL}/members/list`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];

  // Dynamic room pages
  const roomPages: MetadataRoute.Sitemap = roomsData.rooms.map((room) => ({
    url: `${BASE_URL}/rooms/${room.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Room ICS calendar feeds (only for rooms with Google Calendar)
  const roomIcsPages: MetadataRoute.Sitemap = roomsData.rooms
    .filter((room) => room.googleCalendarId)
    .map((room) => ({
      url: `${BASE_URL}/rooms/${room.slug}.ics`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.5,
    }));

  return [...staticPages, ...roomPages, ...roomIcsPages];
}

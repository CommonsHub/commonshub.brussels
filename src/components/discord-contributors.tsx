"use client"

import { useEffect, useState, useMemo } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar } from "lucide-react"
import Link from "next/link"
import settings from "@/settings/settings.json"

interface Contributor {
  id: string
  username: string
  displayName: string
  avatar: string | null
  contributionCount: number
  joinedAt: string | null
}

interface DiscordData {
  contributors: Contributor[]
  totalMembers: number
  activeCommoners: number
  isMockData: boolean
}

interface DiscordContributorsProps {
  filterUserIds?: string[] | null
  selectedMonth?: string | null
}

export function DiscordContributors({ filterUserIds, selectedMonth }: DiscordContributorsProps = {}) {
  const [data, setData] = useState<DiscordData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredContributor, setHoveredContributor] = useState<string | null>(null)

  useEffect(() => {
    async function fetchContributors() {
      try {
        const response = await fetch("/api/contributors")
        const result = await response.json()
        // Map generated data shape to component's expected shape
        const contributors = (result.contributors || []).map((c: any) => ({
          id: c.id,
          username: c.profile?.username || "",
          displayName: c.profile?.name || c.profile?.username || "",
          avatar: c.profile?.avatar_url || null,
          contributionCount: (c.discord?.messages || 0) + (c.tokens?.in || 0),
          joinedAt: null,
        }))
        setData({
          contributors,
          totalMembers: result.summary?.totalContributors || contributors.length,
          activeCommoners: contributors.length,
          isMockData: false,
        })
      } catch (error) {
        console.error("Failed to fetch contributors:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchContributors()
  }, [])

  // Always call hooks before any early returns (Rules of Hooks)
  // Filter contributors based on selected month
  const displayedContributors = useMemo(() => {
    if (!data) return []
    return filterUserIds
      ? data.contributors.filter(c => filterUserIds.includes(c.id))
      : data.contributors
  }, [data, filterUserIds])

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 animate-pulse">
              <div className="w-12 h-12 rounded-full bg-muted" />
              <div className="h-3 w-14 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-12">
      {data.isMockData && (
        <p className="text-sm text-muted-foreground text-center italic">
          Sample data shown. Add DISCORD_BOT_TOKEN to display real contributors.
        </p>
      )}

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
        {displayedContributors.map((contributor) => (
          <Link
            key={contributor.id}
            href={`/members/${contributor.username}`}
            className="relative flex flex-col items-center gap-2 group"
            onMouseEnter={() => setHoveredContributor(contributor.id)}
            onMouseLeave={() => setHoveredContributor(null)}
          >
            <Avatar className="w-12 h-12 ring-2 ring-transparent group-hover:ring-primary/50 transition-all">
              <AvatarImage src={contributor.avatar || undefined} alt={contributor.displayName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {contributor.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="text-xs text-muted-foreground text-center truncate w-full">{contributor.displayName}</p>

            {hoveredContributor === contributor.id && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 p-3 bg-card border border-border rounded-lg shadow-lg pointer-events-none">
                <div className="flex items-start gap-3 mb-2">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={contributor.avatar || undefined} alt={contributor.displayName} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {contributor.displayName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-sm truncate">{contributor.displayName}</p>
                    <p className="text-xs text-muted-foreground">@{contributor.username}</p>
                  </div>
                </div>
                {contributor.joinedAt && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>
                      Member since{" "}
                      {new Date(contributor.joinedAt).toLocaleDateString("en-GB", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
                <p className="mt-2 text-xs text-primary font-medium">Click to view profile</p>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

export function DiscordStats() {
  const [data, setData] = useState<DiscordData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/contributors")
        const result = await response.json()
        setData(result)
      } catch (error) {
        console.error("Failed to fetch Discord stats:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return { totalMembers: "...", activeCommoners: "..." }
  }

  return {
    totalMembers: data?.totalMembers || 0,
    activeCommoners: data?.activeCommoners || 0,
  }
}

export function useDiscordStats() {
  const [stats, setStats] = useState<{ totalMembers: number; activeCommoners: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("/api/contributors")
        const result = await response.json()
        setStats({
          totalMembers: result.summary?.totalContributors || 0,
          activeCommoners: (result.contributors || []).length,
        })
      } catch (error) {
        console.error("Failed to fetch Discord stats:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return { stats, loading }
}

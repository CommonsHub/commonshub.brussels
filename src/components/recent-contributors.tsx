"use client"

import { useEffect, useState, useMemo } from "react"
import { MemberCard } from "@/components/member-card"

interface Contributor {
  id: string
  profile: {
    name: string
    username: string
    description: string | null
    avatar_url: string | null
    roles: string[]
  }
  tokens: {
    in: number
    out: number
  }
  discord: {
    messages: number
    mentions: number
  }
  address: string | null
}

interface ContributorsData {
  period?: string
  since?: string
  until?: string
  contributors: Contributor[]
}

function formatPeriod(period?: string): string {
  if (!period) return "recently"
  const match = /^(\d+)days?$/i.exec(period)
  if (match) {
    const days = parseInt(match[1], 10)
    if (days % 30 === 0 && days >= 60) {
      return `in the last ${days / 30} months`
    }
    return `in the last ${days} days`
  }
  return period
}

/**
 * Display recent contributors from the latest generated data
 */
export function RecentContributors() {
  const [contributorsData, setContributorsData] = useState<ContributorsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRecentContributors() {
      try {
        const response = await fetch("/data/latest/generated/contributors.json")
        if (response.ok) {
          const data = await response.json()
          setContributorsData(data)
        }
      } catch (error) {
        console.error("Failed to fetch recent contributors:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRecentContributors()
  }, [])

  const { displayedContributors, stats } = useMemo(() => {
    const allContributors = contributorsData?.contributors || []

    // Filter: only show those with avatars and activity
    const visibleContributors = allContributors
      .filter(
        (contributor) =>
          contributor.profile.avatar_url && // Must have avatar
          contributor.tokens.in > 0 // Must have received tokens
      )
      .sort((a, b) => b.tokens.in - a.tokens.in) // Sort by tokens received

    const totalTokensReceived = visibleContributors.reduce(
      (sum, c) => sum + c.tokens.in,
      0
    )

    return {
      displayedContributors: visibleContributors,
      stats: {
        totalContributors: visibleContributors.length,
        totalTokens: totalTokensReceived,
      },
    }
  }, [contributorsData])

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

  if (displayedContributors.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No recent contributors found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="space-y-1 text-center">
        <div className="flex justify-center gap-8 text-sm text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">{stats.totalContributors}</span> active contributors
          </div>
          <div>
            <span className="font-medium text-foreground">{Math.round(stats.totalTokens)}</span> CHT distributed
          </div>
        </div>
        <p className="text-xs text-muted-foreground/80">
          {formatPeriod(contributorsData?.period)}
        </p>
      </div>

      {/* Contributors Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
        {displayedContributors.map((contributor) => (
          <MemberCard
            key={contributor.id}
            member={{
              id: contributor.id,
              username: contributor.profile.username,
              displayName: contributor.profile.name,
              avatar: contributor.profile.avatar_url,
            }}
            size="sm"
            showTokens={true}
            tokensReceived={contributor.tokens.in}
          />
        ))}
      </div>
    </div>
  )
}

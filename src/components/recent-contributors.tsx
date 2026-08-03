"use client"

import { useEffect, useState, useMemo } from "react"
import { MemberCard } from "@/components/member-card"

interface Contributor {
  id: string
  username: string
  displayName: string
  avatar: string | null
  contributionCount: number
  joinedAt: string | null
  walletAddress?: string | null
}

interface ContributorsData {
  contributors: Contributor[]
  totalMembers: number
  activeCommoners: number
  timestamp: number
  isMockData: boolean
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
        const response = await fetch("/api/contributors")
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
          contributor.avatar &&
          contributor.contributionCount > 0
      )
      .sort((a, b) => b.contributionCount - a.contributionCount)

    const totalContributions = visibleContributors.reduce(
      (sum, contributor) => sum + contributor.contributionCount,
      0
    )

    return {
      displayedContributors: visibleContributors,
      stats: {
        totalContributors: visibleContributors.length,
        totalContributions,
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
            <span className="font-medium text-foreground">{stats.totalContributions}</span> contributions
          </div>
        </div>
      </div>

      {/* Contributors Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
        {displayedContributors.map((contributor) => (
          <MemberCard
            key={contributor.id}
            member={{
              id: contributor.id,
              username: contributor.username,
              displayName: contributor.displayName,
              avatar: contributor.avatar,
              contributionCount: contributor.contributionCount,
            }}
            size="sm"
            showTokens={false}
            showContributionCount={true}
          />
        ))}
      </div>
    </div>
  )
}

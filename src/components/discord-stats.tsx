"use client"

import { useEffect, useState } from "react"
import { Users } from "lucide-react"

interface DiscordStatsData {
  totalMembers: number
}

export function DiscordStatsDisplay() {
  const [stats, setStats] = useState<DiscordStatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/contributors")
        const data = await response.json()
        setStats({
          totalMembers: data.summary?.totalDiscordMembers || 0,
        })
      } catch (error) {
        console.error("Failed to fetch Discord stats:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  return (
    <div>
      <div className="flex justify-center mb-3">
        <Users className="w-8 h-8 text-primary" />
      </div>
      <p className="text-3xl font-bold text-foreground">{loading ? "..." : stats?.totalMembers || "0"}</p>
      <p className="text-sm text-muted-foreground">Discord Members</p>
    </div>
  )
}

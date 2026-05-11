"use client"

import { useState, useEffect, useMemo } from "react"
import { DiscordImageGallery } from "@/components/discord-image-gallery"
import { CommunityActivityGrid } from "@/components/community-activity-grid"
import { MemberCard } from "@/components/member-card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import settings from "@/settings/settings.json"

interface Contributor {
  id: string
  username: string
  displayName: string
  avatar: string | null
  contributionCount: number
  joinedAt: string | null
}

interface ImagePost {
  imageUrl: string
  author: {
    id: string
    displayName: string
    avatar: string | null
  }
  message: string
  timestamp: string
}

interface DiscordData {
  contributors: Contributor[]
  totalMembers: number
  activeCommoners: number
  images?: ImagePost[] // Fetched separately from images.json and merged
  isMockData: boolean
  userMap?: Record<string, { username: string; displayName: string }>
  channelMap?: Record<string, string>
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

export default function ContributionsPage() {
  const [data, setData] = useState<DiscordData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [selectedContributors, setSelectedContributors] = useState<string[] | null>(null)
  const router = useRouter()

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch images and contributors data in parallel
        const [imagesResponse, contributorsResponse] = await Promise.all([
          fetch("/api/images"),
          fetch("/api/contributors")
        ])

        const imagesData = await imagesResponse.json()
        const contributorsData = await contributorsResponse.json()

        // Merge the data - use images from static file, everything else from contributors endpoint
        const result = {
          ...contributorsData,
          images: imagesData.images.map((image: any) => ({
            imageUrl: image.url,
            author: image.author,
            message: image.message,
            timestamp: image.timestamp,
          }))
        }
        setData(result)
      } catch (error) {
        console.error("Failed to fetch contributors:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleMonthSelect = (month: string | null, contributors: string[]) => {
    setSelectedContributors(month ? contributors : null)
    setSelectedMonth(month)

    // Navigate to month-specific page if month is selected
    if (month) {
      const [year, monthNum] = month.split("-")
      router.push(`/contributions/${year}/${monthNum}`)
    }
  }

  // Filter contributors and images based on selected month
  const displayedContributors = useMemo(() => {
    if (!data) return []
    return selectedContributors
      ? data.contributors.filter(c => selectedContributors.includes(c.id))
      : data.contributors
  }, [data, selectedContributors])

  const displayedImages = useMemo(() => {
    if (!data || !data.images) return []
    const filtered = selectedMonth
      ? data.images.filter(img => {
          const imgDate = new Date(img.timestamp)
          const imgMonth = `${imgDate.getFullYear()}-${String(imgDate.getMonth() + 1).padStart(2, '0')}`
          return imgMonth === selectedMonth
        })
      : data.images
    // Limit to max 20 images
    return filtered.slice(0, 24)
  }, [data, selectedMonth])

  const getTitle = () => {
    if (!selectedMonth) return "Recent Contributions"
    const [year, month] = selectedMonth.split("-")
    const monthName = MONTH_NAMES[parseInt(month, 10) - 1]
    return `Contributions in ${monthName} ${year}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-24">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-64 mx-auto" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Build userMap from contributors if not present
  const userMap = data.userMap || Object.fromEntries(
    data.contributors.map(c => [c.id, { username: c.username, displayName: c.displayName }])
  )
  const channelMap = data.channelMap || {}

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24">
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <Button variant="ghost" size="sm" asChild className="mb-4">
                <Link href="/members">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Members
                </Link>
              </Button>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Community Contributions
              </h1>
              <p className="text-muted-foreground max-w-2xl">
                View all contributions from our community members. Click on a month to see contributions from that period.
              </p>
            </div>

            {/* Activity Grid */}
            <div className="mb-12">
              <h2 className="text-xl font-semibold text-foreground mb-6">Activity Timeline</h2>
              <CommunityActivityGrid onMonthSelect={handleMonthSelect} />
            </div>

            {/* Contributors Grid */}
            <div className="mb-12">
              <h2 className="text-xl font-semibold text-foreground mb-6">
                {selectedMonth ? `Active in ${getTitle().replace('Contributions in ', '')}` : 'Active Contributors'}
              </h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {displayedContributors.map((contributor) => (
                  <MemberCard
                    key={contributor.id}
                    member={{
                      id: contributor.id,
                      username: contributor.username,
                      displayName: contributor.displayName,
                      avatar: contributor.avatar,
                    }}
                    size="sm"
                    showTokens={false}
                    showContributionCount={true}
                  />
                ))}
              </div>
            </div>

            {/* Image Gallery */}
            {displayedImages.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">{getTitle()}</h2>
                <DiscordImageGallery
                  images={displayedImages}
                  showMessage={true}
                  thumbnailSize="md"
                  userMap={userMap}
                  channelMap={channelMap}
                  guildId={settings.discord.guildId}
                />
              </div>
            )}

            {displayedImages.length === 0 && selectedMonth && (
              <div className="text-center py-12 text-muted-foreground">
                No contributions found for this month.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

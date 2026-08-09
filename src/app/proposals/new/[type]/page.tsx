import { notFound } from "next/navigation"
import proposalSettings from "@/settings/proposals.json"
import roomsData from "@/settings/rooms.json"
import Link from "next/link"
import {
  ArrowLeft, DoorOpen, Calendar, GraduationCap, Coins, Hammer, MessageSquare,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  DoorOpen, Calendar, GraduationCap, Coins, Hammer, MessageSquare,
}

interface PageProps {
  params: Promise<{ type: string }>
}

export async function generateStaticParams() {
  return proposalSettings.types.map((t) => ({ type: t.id }))
}

export default async function NewProposalTypePage({ params }: PageProps) {
  const { type: typeId } = await params
  const type = proposalSettings.types.find((t) => t.id === typeId)

  if (!type) {
    notFound()
  }

  const Icon = ICONS[type.icon] || MessageSquare
  const rooms = roomsData.rooms

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24">
        <section className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto">
            <Button variant="ghost" size="sm" asChild className="mb-4">
              <Link href="/proposals/new">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
            </Button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${type.color}15`, color: type.color }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">New {type.label} Proposal</h1>
                <p className="text-sm text-muted-foreground">{type.description}</p>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Title</label>
                <input
                  type="text"
                  placeholder={`e.g. ${
                    typeId === "booking" ? "Team meeting — March sprint planning"
                    : typeId === "event" ? "Commons Game — March Edition"
                    : typeId === "workshop" ? "Intro to Regenerative Economics"
                    : typeId === "finance" ? "New espresso machine for the kitchen"
                    : typeId === "space" ? "Garden renovation — spring planting"
                    : "Discussion: Sunday opening hours"
                  }`}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <textarea
                  placeholder="Describe your proposal in detail... (Markdown supported)"
                  rows={6}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Type-specific fields */}
              {type.fields.length > 0 && (
                <div className="border border-border rounded-lg p-4 space-y-4">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-muted-foreground" />
                    {type.label} Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {type.fields.map((field) => (
                      <div key={field.id} className={field.type === "multiselect" ? "sm:col-span-2" : ""}>
                        <label className="block text-sm font-medium mb-1.5">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </label>

                        {field.type === "room-select" ? (
                          <select className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                            <option value="">Select a room...</option>
                            {rooms.map((room) => (
                              <option key={room.id} value={room.id}>
                                {room.name} ({room.capacity} people)
                              </option>
                            ))}
                          </select>
                        ) : field.type === "select" ? (
                          <select className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary">
                            <option value="">Select...</option>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.type === "multiselect" ? (
                          <div className="flex flex-wrap gap-2">
                            {field.options?.map((opt) => (
                              <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                <input type="checkbox" className="rounded border-border" />
                                {opt}
                              </label>
                            ))}
                          </div>
                        ) : field.type === "boolean" ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              defaultChecked={field.default === true}
                              className="rounded border-border"
                            />
                            <span className="text-sm text-muted-foreground">Yes</span>
                          </div>
                        ) : field.type === "date" ? (
                          <input
                            type="date"
                            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        ) : field.type === "time" ? (
                          <input
                            type="time"
                            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        ) : field.type === "number" ? (
                          <input
                            type="number"
                            defaultValue={field.default as number | undefined}
                            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        ) : (
                          <input
                            type="text"
                            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Token selection */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold">Payment Token</h3>
                <p className="text-xs text-muted-foreground">
                  Choose which token contributors can use to fund this proposal.
                  The room cost will be calculated automatically based on the room and duration.
                </p>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 px-3 py-2 border border-primary bg-primary/5 rounded-lg cursor-pointer">
                    <input type="radio" name="token" value="CHT" defaultChecked className="text-primary" />
                    <span className="text-sm font-medium">CHT</span>
                    <span className="text-xs text-muted-foreground">Commons Hub Token</span>
                  </label>
                  <label className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg cursor-pointer hover:border-primary/50">
                    <input type="radio" name="token" value="EURb" className="text-primary" />
                    <span className="text-sm font-medium">EURb</span>
                    <span className="text-xs text-muted-foreground">pay.brussels</span>
                  </label>
                </div>
              </div>

              {/* Submit */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Sign in with Discord to submit your proposal
                </p>
                <Button disabled>
                  Submit Proposal
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

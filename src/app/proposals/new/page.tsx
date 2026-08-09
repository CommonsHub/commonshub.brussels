import proposalSettings from "@/settings/proposals.json"
import Link from "next/link"
import { ArrowLeft, DoorOpen, Calendar, GraduationCap, Coins, Hammer, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  DoorOpen, Calendar, GraduationCap, Coins, Hammer, MessageSquare,
}

export const metadata = {
  title: "New Proposal — Commons Hub Brussels",
}

export default function NewProposalPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24">
        <section className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto">
            <Button variant="ghost" size="sm" asChild className="mb-4">
              <Link href="/proposals">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Proposals
              </Link>
            </Button>

            <h1 className="text-2xl font-bold text-foreground mb-2">New Proposal</h1>
            <p className="text-sm text-muted-foreground mb-8">
              What kind of proposal would you like to make?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {proposalSettings.types.map((type) => {
                const Icon = ICONS[type.icon] || MessageSquare
                return (
                  <Link
                    key={type.id}
                    href={`/proposals/new/${type.id}`}
                    className="flex items-start gap-3 p-4 border border-border rounded-lg hover:border-primary hover:bg-muted/30 transition-colors group"
                  >
                    <div
                      className="p-2 rounded-lg flex-shrink-0 transition-colors"
                      style={{ backgroundColor: `${type.color}15`, color: type.color }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {type.label}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {type.description}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>

            <p className="text-xs text-muted-foreground mt-6 text-center">
              Sign in with Discord to create a proposal
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

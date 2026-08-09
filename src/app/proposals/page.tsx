import Link from "next/link"
import { getProposals } from "@/lib/proposals-data"
import proposalSettings from "@/settings/proposals.json"
import { ProposalFilters } from "./proposal-filters"
import { ProposalListItem } from "./proposal-list-item"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export const metadata = {
  title: "Proposals — Commons Hub Brussels",
  description: "Community proposals for the Commons Hub Brussels — events, bookings, workshops, and more.",
}

export default function ProposalsPage() {
  const proposals = getProposals()

  return (
    <div className="min-h-screen bg-background">
      <main className="pt-24">
        <section className="py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Proposals</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {proposals.length} proposals — manage the hub like an open source project
                </p>
              </div>
              <Button asChild>
                <Link href="/proposals/new">
                  <Plus className="w-4 h-4 mr-2" />
                  New proposal
                </Link>
              </Button>
            </div>

            {/* Filters */}
            <ProposalFilters
              types={proposalSettings.types}
              statuses={proposalSettings.statuses}
            />

            {/* Proposal list */}
            <div className="border border-border rounded-lg overflow-hidden bg-card">
              {proposals.map((proposal, index) => (
                <ProposalListItem
                  key={proposal.id}
                  proposal={proposal}
                  types={proposalSettings.types}
                  statuses={proposalSettings.statuses}
                  isLast={index === proposals.length - 1}
                />
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

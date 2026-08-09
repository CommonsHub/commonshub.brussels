"use client"

import { useState } from "react"
import { Search, SlidersHorizontal } from "lucide-react"

interface FilterProps {
  types: { id: string; label: string; color: string }[]
  statuses: { id: string; label: string; color: string }[]
}

export function ProposalFilters({ types, statuses }: FilterProps) {
  const [activeStatus, setActiveStatus] = useState<string>("open")
  const [activeType, setActiveType] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  return (
    <div className="mb-4 space-y-3">
      {/* Top bar: search + status tabs */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search proposals..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
            showFilters
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveStatus("open")}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeStatus === "open"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Open
        </button>
        <button
          onClick={() => setActiveStatus("funded")}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeStatus === "funded"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Funded
        </button>
        <button
          onClick={() => setActiveStatus("completed")}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeStatus === "completed"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Completed
        </button>
        <button
          onClick={() => setActiveStatus("all")}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeStatus === "all"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg">
          <span className="text-xs font-medium text-muted-foreground self-center mr-1">Type:</span>
          {types.map((type) => (
            <button
              key={type.id}
              onClick={() => setActiveType(activeType === type.id ? null : type.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                activeType === type.id
                  ? "border-current text-white"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
              style={activeType === type.id ? { backgroundColor: type.color, borderColor: type.color } : {}}
            >
              {type.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

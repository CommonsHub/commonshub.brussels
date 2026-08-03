"use client";

import { useEffect, useMemo, useState } from "react";

interface Member {
  id: string;
  firstName?: string | null;
  status?: string;
  isOrganization?: boolean;
}

interface MembersFile {
  members: Member[];
}

interface Contributor {
  displayName: string | null;
  username: string | null;
  avatar: string | null;
  contributionCount: number;
}

interface ContributorsFile {
  contributors: Contributor[];
}

function norm(s: string | null | undefined): string {
  return (s || "").toLowerCase().trim();
}

function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b([a-zà-ÿ])/g, (m) => m.toUpperCase());
}

export function OtherMembers() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [shownNames, setShownNames] = useState<Set<string> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [mRes, cRes] = await Promise.all([
          fetch("/api/members"),
          fetch("/api/contributors"),
        ]);
        if (mRes.ok) {
          const m: MembersFile = await mRes.json();
          setMembers(m.members || []);
        }
        if (cRes.ok) {
          const c: ContributorsFile = await cRes.json();
          const names = new Set<string>();
          for (const contrib of c.contributors || []) {
            // Same filter as RecentContributors (avatar + contribution count)
            if (contrib.avatar && contrib.contributionCount > 0) {
              const n = norm(contrib.displayName);
              const u = norm(contrib.username);
              if (n) names.add(n);
              if (u) names.add(u);
            }
          }
          setShownNames(names);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!members) return [];
    return members
      .filter((m) => m.status === "active" || m.status === "trialing")
      .filter((m) => !m.isOrganization)
      .filter((m) => {
        if (!shownNames) return true;
        const fn = norm(m.firstName);
        return !fn || !shownNames.has(fn);
      })
      .sort((a, b) =>
        (a.firstName || "").toLowerCase().localeCompare((b.firstName || "").toLowerCase()),
      );
  }, [members, shownNames]);

  if (loading || filtered.length === 0) return null;

  const names = filtered
    .map((m) => (m.firstName ? toTitleCase(m.firstName) : "—"))
    .join(", ");

  return (
    <p className="mt-8 text-sm text-muted-foreground text-center max-w-3xl mx-auto leading-relaxed">
      <span className="font-medium text-foreground">+{filtered.length} other members</span>:{" "}
      {names}
    </p>
  );
}

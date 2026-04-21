import { auth } from "@/auth";
import settings from "@/settings/settings.json";
import {
  loadQuarterlyOdoo,
  type Quarter,
  type QuarterlyData,
} from "@/lib/odoo-quarter";
import { QuarterlyReportView } from "./quarterly-report-view";
import { ReportNotAvailable } from "./report-not-available";

interface QuarterlyReportProps {
  year: string;
  quarter: Quarter;
}

export const dynamic = "force-dynamic";

interface Perms {
  isMember: boolean;
  isSteward: boolean;
}

async function getPerms(): Promise<Perms> {
  try {
    const session = await auth();
    if (!session?.user) return { isMember: false, isSteward: false };
    const user = session.user as {
      roles?: string[];
      roleDetails?: Array<{ id: string; name: string }>;
    };
    const memberRoleId = settings.discord?.roles?.member;
    const isMember = memberRoleId ? (user.roles || []).includes(memberRoleId) : false;
    const isSteward = (user.roleDetails || []).some((r) =>
      (r.name || "").toLowerCase().includes("steward"),
    );
    return { isMember: isMember || isSteward, isSteward };
  } catch {
    return { isMember: false, isSteward: false };
  }
}

export async function QuarterlyReport({ year, quarter }: QuarterlyReportProps) {
  const perms = await getPerms();
  const data: QuarterlyData = loadQuarterlyOdoo(year, quarter, {
    showPii: perms.isMember,
    showOdooLinks: perms.isSteward,
  });

  if (data.rows.length === 0) {
    return (
      <ReportNotAvailable
        message={`The ${year} Q${quarter} report isn't available yet. See how ${year} is going so far in the yearly report.`}
        backHref={`/${year}`}
        backLabel={`Go to ${year} yearly report`}
      />
    );
  }

  return <QuarterlyReportView data={data} showPii={perms.isMember} />;
}

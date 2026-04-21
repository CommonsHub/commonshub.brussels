import { auth } from "@/auth";
import settings from "@/settings/settings.json";
import {
  loadQuarterlyOdoo,
  type Quarter,
  type QuarterlyData,
} from "@/lib/odoo-quarter";
import { QuarterlyReportView } from "./quarterly-report-view";

interface QuarterlyReportProps {
  year: string;
  quarter: Quarter;
}

export const dynamic = "force-dynamic";

async function isMember(): Promise<boolean> {
  try {
    const session = await auth();
    const memberRoleId = settings.discord?.roles?.member;
    if (!session?.user || !memberRoleId) return false;
    const roles = (session.user as { roles?: string[] }).roles || [];
    return roles.includes(memberRoleId);
  } catch {
    return false;
  }
}

export async function QuarterlyReport({ year, quarter }: QuarterlyReportProps) {
  if (!/^\d{4}$/.test(year)) {
    return (
      <main className="min-h-screen bg-background">
        <div className="pt-24 pb-16 max-w-4xl mx-auto px-6">
          <h1 className="text-2xl font-bold">Invalid year</h1>
        </div>
      </main>
    );
  }

  const showPii = await isMember();
  const data: QuarterlyData = loadQuarterlyOdoo(year, quarter, { showPii });

  return <QuarterlyReportView data={data} showPii={showPii} />;
}

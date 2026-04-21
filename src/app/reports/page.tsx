import * as fs from "fs";
import * as path from "path";
import Link from "next/link";
import { DATA_DIR } from "@/lib/data-paths";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Reports | Commons Hub Brussels",
  description: "Browse yearly, quarterly and monthly reports for the Commons Hub Brussels.",
};

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface YearReports {
  year: string;
  months: string[]; // "01" .. "12", only those present in DATA_DIR
  availableQuarters: number[]; // quarters that are over AND have odoo data
}

function monthHasOdooData(year: string, month: string): boolean {
  const p = path.join(DATA_DIR, year, month, "finance", "odoo");
  return fs.existsSync(p);
}

function monthIsOver(year: string, month: string): boolean {
  const now = new Date();
  const y = parseInt(year, 10);
  const m = parseInt(month, 10); // 1..12
  const monthEnd = new Date(y, m, 1); // first of the following month
  return now >= monthEnd;
}

function quarterIsOver(year: string, quarter: number): boolean {
  // Quarter q ends at the end of month (q*3). Consider it over once the
  // calendar has moved to a later month.
  const now = new Date();
  const y = parseInt(year, 10);
  const quarterEnd = new Date(y, quarter * 3, 1); // first of the month following the quarter
  return now >= quarterEnd;
}

function scanReports(): YearReports[] {
  if (!fs.existsSync(DATA_DIR)) return [];

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const years: YearReports[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!/^20\d{2}$/.test(entry.name)) continue;

    const yearPath = path.join(DATA_DIR, entry.name);
    let monthEntries: fs.Dirent[] = [];
    try {
      monthEntries = fs.readdirSync(yearPath, { withFileTypes: true });
    } catch {
      continue;
    }

    const months = monthEntries
      .filter((e) => e.isDirectory() && /^(0[1-9]|1[0-2])$/.test(e.name))
      .map((e) => e.name)
      .filter((m) => monthIsOver(entry.name, m))
      .sort();

    const availableQuarters: number[] = [];
    for (const q of [1, 2, 3, 4]) {
      if (!quarterIsOver(entry.name, q)) continue;
      const qMonths = [q * 3 - 2, q * 3 - 1, q * 3].map((n) =>
        n.toString().padStart(2, "0"),
      );
      const hasData = qMonths.some((m) => monthHasOdooData(entry.name, m));
      if (hasData) availableQuarters.push(q);
    }

    years.push({ year: entry.name, months, availableQuarters });
  }

  return years.sort((a, b) => b.year.localeCompare(a.year));
}

export default function ReportsIndexPage() {
  const years = scanReports();

  return (
    <main className="min-h-screen bg-background">
      <div className="pt-24 pb-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Reports
          </h1>
          <p className="text-muted-foreground">
            Yearly, quarterly and monthly reports based on data synced from
            Stripe, Odoo, Discord, and the CELO blockchain.
          </p>
        </div>

        {years.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No reports available yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {years.map((year) => (
              <Card key={year.year}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-4">
                    <Link
                      href={`/${year.year}`}
                      className="text-2xl font-bold hover:underline"
                    >
                      {year.year}
                    </Link>
                    <span className="text-sm text-muted-foreground font-normal">
                      {year.months.length} month
                      {year.months.length === 1 ? "" : "s"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Quarters */}
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                      Quarters
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4].map((q) => {
                        const available = year.availableQuarters.includes(q);
                        if (!available) {
                          return (
                            <Badge
                              key={q}
                              variant="outline"
                              className="text-muted-foreground/50"
                            >
                              Q{q}
                            </Badge>
                          );
                        }
                        return (
                          <Link key={q} href={`/${year.year}/Q${q}`}>
                            <Badge
                              variant="secondary"
                              className="hover:bg-accent cursor-pointer"
                            >
                              Q{q}
                            </Badge>
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  {/* Months */}
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                      Months
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {Array.from({ length: 12 }, (_, i) => {
                        const m = String(i + 1).padStart(2, "0");
                        const available = year.months.includes(m);
                        const label = MONTH_NAMES[i];
                        if (!available) {
                          return (
                            <div
                              key={m}
                              className="text-xs text-muted-foreground/50 px-2 py-1.5"
                            >
                              {label}
                            </div>
                          );
                        }
                        return (
                          <Link
                            key={m}
                            href={`/${year.year}/${m}`}
                            className="text-xs px-2 py-1.5 rounded hover:bg-accent transition-colors text-foreground"
                          >
                            {label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

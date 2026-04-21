import { parseQuarter } from "@/lib/odoo-quarter";
import { MonthlyReportClient } from "./monthly-report-client";
import { QuarterlyReport } from "@/components/quarterly-report";

interface PageProps {
  params: Promise<{ year: string; month: string }>;
}

export default async function YearMonthPage({ params }: PageProps) {
  const { year, month } = await params;

  const quarter = parseQuarter(month);
  if (quarter !== null) {
    return <QuarterlyReport year={year} quarter={quarter} />;
  }

  return <MonthlyReportClient />;
}

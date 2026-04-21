import { notFound } from "next/navigation";
import { parseQuarter } from "@/lib/odoo-quarter";
import { MonthlyReportClient } from "./monthly-report-client";
import { QuarterlyReport } from "@/components/quarterly-report";

const YEAR_RE = /^20\d{2}$/;
const MONTH_RE = /^(0[1-9]|1[0-2])$/;

interface PageProps {
  params: Promise<{ year: string; month: string }>;
}

export default async function YearMonthPage({ params }: PageProps) {
  const { year, month } = await params;

  if (!YEAR_RE.test(year)) {
    notFound();
  }

  const quarter = parseQuarter(month);
  if (quarter !== null) {
    return <QuarterlyReport year={year} quarter={quarter} />;
  }

  if (!MONTH_RE.test(month)) {
    notFound();
  }

  return <MonthlyReportClient />;
}

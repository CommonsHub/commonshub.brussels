import { notFound } from "next/navigation";
import { YearlyReportClient } from "./yearly-report-client";

const YEAR_RE = /^20\d{2}$/;

interface PageProps {
  params: Promise<{ year: string }>;
}

export default async function YearPage({ params }: PageProps) {
  const { year } = await params;
  if (!YEAR_RE.test(year)) {
    notFound();
  }
  return <YearlyReportClient />;
}

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock } from "lucide-react";

interface ReportNotAvailableProps {
  title?: string;
  message?: string;
  backHref: string;
  backLabel: string;
}

export function ReportNotAvailable({
  title = "Report not available yet",
  message,
  backHref,
  backLabel,
}: ReportNotAvailableProps) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-4">
          <Clock className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
        {message && (
          <p className="text-muted-foreground mb-8 leading-relaxed">{message}</p>
        )}
        <Button asChild variant="outline">
          <Link href={backHref}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {backLabel}
          </Link>
        </Button>
      </div>
    </main>
  );
}

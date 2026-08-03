import { Button } from "@/components/ui/button";
import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";

export default function MemberNotFound() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <div className="w-64 h-64 mx-auto mb-8">
          <img
            src="/images/travolta.gif"
            alt="Confused Travolta looking around"
            className="w-full h-full object-contain"
          />
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-2">
          Member not found
        </h1>
        <p className="text-muted-foreground mb-8">Where is he/she hiding?</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="outline">
            <Link href="/community">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Community
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}

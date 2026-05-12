import Link from "next/link";
import { ArrowLeft, MapPin, Utensils } from "lucide-react";
import { CommunityActivityGallery } from "@/components/community-activity-gallery";

export const metadata = {
  title: "Volunteer | Commons Hub Brussels",
  description:
    "Come help run the Commons Hub — set up rooms, welcome guests, share food. Earn tokens you can redeem to use the space for free.",
};

const CONTRIBUTIONS_CHANNEL_ID = "1297965144579637248";

export default function VolunteerPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
      </div>

      {/* Hero Section */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-8 text-balance">
              Help run the Commons Hub
            </h1>

            <div className="prose prose-lg dark:prose-invert max-w-none space-y-6">
              <p className="text-xl text-muted-foreground leading-relaxed">
                The Commons Hub is a common space that we manage collectively as
                a community.
              </p>
              <p className="text-xl text-muted-foreground leading-relaxed">
                We pay the rent by renting the second floor for various events.
                This requires work — setting up the room, welcoming guests,
                bringing coffee, snacks, food, cleaning afterwards. We have a
                lot of bookings in June and we could use some extra help.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tokens Section */}
      <section className="py-12 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6 text-center">
              Contribute, earn tokens, use the space
            </h2>
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <p className="text-xl text-muted-foreground leading-relaxed text-center">
                By contributing to the hub, you receive tokens that can be
                redeemed to make use of the space for free. So that you too can
                make use of this beautiful space just in front of Central
                Station to organise events, workshops or to co-work.
              </p>
              <p className="text-center mt-8">
                <Link
                  href="/economy"
                  className="text-primary hover:underline font-medium"
                >
                  Learn more about our token economy →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-center">
              Contributions in action
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-12 text-center max-w-3xl mx-auto">
              A glimpse of the small and big things community members do every
              week to keep the hub alive.
            </p>
            <CommunityActivityGallery
              channelId={CONTRIBUTIONS_CHANNEL_ID}
              maxImages={12}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Come say hi
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-10">
              Just walk in, or come any Friday at 12:30pm for our potluck to
              meet the community. We don&apos;t bite&nbsp;;-)
            </p>

            <div className="grid md:grid-cols-2 gap-6 text-left">
              <a
                href="https://maps.google.com/?q=rue+de+la+Madeleine+51,+1000+Brussels"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-background rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <MapPin className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Walk in
                </h3>
                <p className="text-muted-foreground">
                  rue de la Madeleine 51
                  <br />
                  1000 Brussels — first floor
                </p>
                <p className="text-sm text-primary mt-3 group-hover:underline">
                  Open in maps →
                </p>
              </a>

              <div className="bg-background rounded-xl p-6 shadow-sm">
                <Utensils className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Friday potluck
                </h3>
                <p className="text-muted-foreground">
                  Every Friday at 12:30pm.
                  <br />
                  Bring something to share if you can.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

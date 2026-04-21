import Image from "@/components/optimized-image";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Users } from "lucide-react";
import { CommunityActivityGallery } from "@/components/community-activity-gallery";
import { StewardRolesPreview } from "@/components/steward-roles-preview";
import roomsData from "@/settings/rooms.json";

export const metadata = {
  title: "Economy | Commons Hub Brussels",
  description:
    "A new economic model to sustain our community with the Commons Hub Token",
};

export default function EconomyPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/#economy"
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
              A new economic model to sustain our community
            </h1>

            <div className="prose prose-lg dark:prose-invert max-w-none space-y-6">
              <p className="text-xl text-muted-foreground leading-relaxed">
                It takes more than just money to bring life to a community. It
                takes love, care and countless hours of small contributions that
                are too often unseen and under valued.
              </p>

              <p className="text-xl text-muted-foreground leading-relaxed">
                We can complain about the fact that our existing economic model
                is unable to properly recognize that value. At the Commons Hub,
                we don't really have the time to wait for others to change how
                our system works. So we just experiment in our community with
                different models.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Token Section */}
      <section className="py-12 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 items-center mb-12">
              <div className="aspect-square relative rounded-2xl overflow-hidden bg-neutral-900">
                <Image
                  src="/images/cht-tokens.avif"
                  alt="Commons Hub Brussels Token (CHT)"
                  fill
                  className="object-cover"
                />
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                  The Commons Hub Token
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  That's how we came up with our own community token. The
                  Commons Hub Token.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Unlike the Euro token which is a scarce yang currency that
                  measures your contribution to the GDP and invites you to
                  compete, the Commons Hub Token is an abundant yin currency.
                </p>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  It's brought into existence as soon as a member of the
                  community contributes time, energy and care for the community.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Community Photos */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8 text-center">
              Community contributions in action
            </h2>
            <CommunityActivityGallery channelId="1280924924625682484" />
          </div>
        </div>
      </section>

      {/* Redemption Section */}
      <section className="py-12 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6 text-center">
              Redeem your tokens
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-12 text-center max-w-3xl mx-auto">
              Those tokens can then be redeemed to make use of the different
              resources that the community has to offer.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roomsData.rooms
                .filter((room) => room.tokensPerHour > 0)
                .map((room) => (
                  <Link
                    key={room.id}
                    href={`/rooms/${room.slug}`}
                    className="group bg-background rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-[4/3] relative overflow-hidden">
                      <Image
                        src={room.heroImage || "/placeholder.svg"}
                        alt={room.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-foreground mb-2">
                        {room.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {room.shortDescription}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="w-4 h-4" />
                          <span>Up to {room.capacity}</span>
                        </div>
                        <div className="text-primary font-semibold">
                          {room.tokensPerHour} CHT/hour
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
            </div>

            <div className="text-center mt-8">
              <Link
                href="/rooms"
                className="text-primary hover:underline font-medium"
              >
                View all rooms →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How to earn tokens */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6 text-center">
              How to earn tokens?
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-12 text-center max-w-3xl mx-auto">
              You can pick up a steward role. This will give you a recurring
              amount of tokens every week for taking responsibility over a part
              of the common.
            </p>

            <StewardRolesPreview />
          </div>
        </div>
      </section>

      {/* Shifts Section */}
      <section className="py-12 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-center">
              Join organized shifts
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-8 text-center max-w-3xl mx-auto">
              You can also join one of the organized shifts to steward a booking
              or improve the space.
            </p>
            <CommunityActivityGallery channelId="1443604838255427584" />
          </div>
        </div>
      </section>

      {/* Contributions Section */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4 text-center">
              Every contribution counts
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-8 text-center max-w-3xl mx-auto">
              Share your contribution in the #contributions channel on our
              Discord. We review them every week during our Heartbeat Meeting to
              allocate extra tokens.
            </p>
            <CommunityActivityGallery channelId="1297965144579637248" />
          </div>
        </div>
      </section>

      {/* How to spend tokens */}
      <section className="py-12 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6 text-center">
              How to spend the tokens?
            </h2>
            <div className="prose prose-lg dark:prose-invert max-w-none space-y-6">
              <p className="text-xl text-muted-foreground leading-relaxed text-center">
                You can use your tokens to book a room, get coffee or a drink.
                To book a room, use the{" "}
                <code className="bg-muted px-2 py-1 rounded text-primary">
                  /book
                </code>{" "}
                command on Discord. You can also exchange tokens between each other with the{" "}
                <code className="bg-muted px-2 py-1 rounded text-primary">
                  /send
                </code>{" "}
                command.
              </p>
              <p className="text-xl text-muted-foreground leading-relaxed text-center">
                Whenever you make a proposal to make use of the resources of the
                community (for your community for example), you can negotiate
                the price using some of your tokens. It's basically social
                capital, a proof that you have contributed to the space and the
                community "owes you".
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Behind the scene blockchain section */}
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6 text-center">
              Behind the scene
            </h2>
            <div className="prose prose-lg dark:prose-invert max-w-none space-y-6 mb-8">
              <p className="text-xl text-muted-foreground leading-relaxed text-center">
                The Commons Hub Token is an ERC20 token on the CELO blockchain.
                You can follow it transparently on the blockchain explorer.
              </p>
            </div>

            <div className="flex justify-center mb-12">
              <a
                href="https://txinfo.xyz/celo/token/cht"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
              >
                View CHT on blockchain
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <div className="bg-muted/50 rounded-xl p-8">
              <h3 className="text-xl font-bold text-foreground mb-4">
                Why using the blockchain?
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold">1.</span>
                  <span className="text-muted-foreground">
                    Because it's fun exploring what else is possible with new
                    technologies.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold">2.</span>
                  <span className="text-muted-foreground">
                    Because it uses the same data structure as millions of other
                    currencies around the world, and therefore we can tap into
                    plenty of tools to better manage it.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-primary font-bold">3.</span>
                  <span className="text-muted-foreground">
                    Because it's transparent, nobody can mingle with it without
                    everyone being able to see. The community cannot take tokens
                    away from you "in stoemeling".
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 md:py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Ready to contribute?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join our community and start earning Commons Hub Tokens by
              contributing your time and energy.
            </p>
            <Link
              href="/membership"
              className="inline-flex items-center justify-center px-8 py-4 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Become a member
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

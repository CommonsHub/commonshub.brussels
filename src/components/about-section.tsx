import Image from "@/components/optimized-image"
import Link from "next/link"
import partners from "@/settings/partners.json"

const featuredPartners = partners.filter((p: { featured?: boolean }) => p.featured)

export function AboutSection() {
  return (
    <section id="about" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-balance">
              Where communities come together
            </h2>
            <p className="mt-6 text-lg text-muted-foreground">
              Commons Hub Brussels is more than just a space—it's a living ecosystem where community builders come
              together to share resources, knowledge, and inspiration.
            </p>
            <p className="mt-4 text-lg text-muted-foreground">
              Located in the heart of Brussels, we provide the infrastructure and support for communities to gather,
              collaborate, and thrive. Whether you're hosting an event, looking for a workspace, or seeking to connect
              with like-minded individuals, Commons Hub is your home.
            </p>
            <div className="mt-8">
              <p className="text-sm text-muted-foreground mb-4">Communities that regularly meet at the Commons Hub:</p>
              <div className="flex flex-wrap gap-4 items-center">
                {featuredPartners.map(
                  (partner: {
                    name: string
                    logo: string
                    website: string
                  }) => (
                    <Link
                      key={partner.name}
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative w-10 h-10 grayscale hover:grayscale-0 opacity-70 hover:opacity-100 transition-all"
                      title={partner.name}
                    >
                      <Image
                        src={partner.logo || "/placeholder.svg"}
                        alt={partner.name}
                        fill
                        className="object-contain"
                        sizes="40px"
                      />
                    </Link>
                  ),
                )}
              </div>
              <Link href="/community" className="text-sm text-primary hover:underline mt-4 inline-block">
                Meet all our partner communities →
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            <div className="aspect-video relative rounded-lg overflow-hidden border border-border">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2519.0876543210123!2d4.3565!3d50.8465!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47c3c47f5c0e1234%3A0x1234567890abcdef!2sRue%20de%20la%20Madeleine%2051%2C%201000%20Bruxelles!5e0!3m2!1sen!2sbe!4v1234567890"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Commons Hub Brussels Location"
                className="absolute inset-0"
              />
            </div>
            <a
              href="https://map.commonshub.brussels"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              Commons Hub Brussels, Rue de la Madeleine 51, 1000 Brussels
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

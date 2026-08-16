import { Hero } from "@/components/hero"
import { EventFork } from "@/components/event-fork"
import { AboutSection } from "@/components/about-section"
import { EventsSection } from "@/components/events-section"
import { BookingSection } from "@/components/booking-section"
import { CommonsSection } from "@/components/commons-section"
import { EconomySection } from "@/components/economy-section"
import { MembershipPreviewSection } from "@/components/membership-preview-section"
import { WorkshopsCTA } from "@/components/workshops-cta"
import { NewsletterSection } from "@/components/newsletter-section"
import { EmptyDataState } from "@/components/empty-data-state"
import { hasAnyData } from "@/lib/data-check"

export default function HomePage() {
  // Check if data directory has been populated
  const dataAvailable = hasAnyData();

  if (!dataAvailable) {
    return <EmptyDataState />;
  }

  return (
    <main className="min-h-screen">
      <Hero />
      <EventFork />
      <AboutSection />
      <EventsSection />
      <BookingSection />
      <CommonsSection />
      <EconomySection />
      <MembershipPreviewSection />
      <NewsletterSection />
      <WorkshopsCTA />
    </main>
  )
}

import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FiscalSponsorshipForm } from "@/components/fiscal-sponsorship-form";
import {
  Users,
  ReceiptText,
  HandCoins,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

export const metadata = {
  title: "Fiscal Sponsorship | Commons Hub Brussels",
  description:
    "Organise events, collect ticket sales, receive donations and grants under the legal umbrella of the Commons Hub Brussels.",
};

export default function FiscalSponsorshipPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 bg-primary/5">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 text-balance">
            Fiscal Sponsorship
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
            Run your project under the legal and financial umbrella of the Commons Hub
            Brussels — sell tickets, invoice sponsors, receive donations and grants —
            without having to set up your own legal entity.
          </p>
          <div className="mt-8">
            <a
              href="#apply"
              className="inline-flex items-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Apply for fiscal sponsorship
            </a>
          </div>
        </div>
      </section>

      {/* Who is this for */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Who is this for?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Anyone — individual or collective — building commons from or around the
              Commons Hub Brussels.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-background p-6 rounded-lg border border-border">
              <div className="flex items-start gap-4 mb-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">
                  Event organisers without a legal entity
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You&apos;re organising an event or workshop, and want to sell tickets
                through Luma (or any ticketing platform), but you don&apos;t have a
                legal structure yet.
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                Example:{" "}
                <a
                  href="https://opencollective.com/genesisxp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Genesis
                </a>
              </p>
            </div>

            <div className="bg-background p-6 rounded-lg border border-border">
              <div className="flex items-start gap-4 mb-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <HandCoins className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">
                  Digital commons / open source projects
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You&apos;re building an open source tool for the commons. One of your
                contributors works from Brussels and you&apos;d like to receive
                donations or grants for the project.
              </p>
              <p className="text-sm text-muted-foreground mt-3">
                Example:{" "}
                <a
                  href="https://openletter.earth"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  OpenLetter
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-card/50 border-y border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">
            Why we offer this
          </h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              Over time, individuals and groups often come to the Commons Hub to
              organise an event and want to sell tickets — but they don&apos;t yet have
              a legal entity or bank account of their own. In practice, they&apos;d use
              our Luma account, we&apos;d receive the ticket revenue, keep part of it
              for the room, and reimburse their expenses from what was left.
            </p>
            <p>
              We were already sharing more than a physical space — we were sharing a
              legal entity and a bank account. Offering fiscal sponsorship is simply a
              way to formalize that relationship: transparent, fair, and scalable.
            </p>
          </div>
        </div>
      </section>

      {/* Conditions */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Conditions
          </h2>
          <p className="text-muted-foreground mb-8">
            Because this involves real legal and financial liability, we only sponsor
            people and collectives we see regularly and whose activity we understand.
          </p>
          <ul className="space-y-4">
            <li className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground leading-relaxed">
                At least one core contributor (admin) of your collective is a{" "}
                <Link href="/membership" className="text-primary hover:underline">
                  member of the Commons Hub Brussels
                </Link>
                .
              </p>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground leading-relaxed">
                Your collective organises at least one event per year at the Commons
                Hub, <em>or</em> at least one core contributor regularly works from
                the Commons Hub (at least once every two months).
              </p>
            </li>
            <li className="flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground leading-relaxed">
                You commit to transparency. All income and expenses are shared
                publicly in open source (without personal details).
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* Cost */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-card/50 border-y border-border">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-md bg-primary/10">
              <ReceiptText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
                Cost
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                We keep <span className="font-semibold text-foreground">10% of all income</span>{" "}
                to cover admin and accounting. Any surplus is reinvested to improve the
                shared space used by every project we fiscally host.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">
            Frequently Asked Questions
          </h2>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="legal-status">
              <AccordionTrigger className="text-base">
                What&apos;s the legal status of our collective?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                If we fiscally sponsor you, your collective becomes a project of our
                non-profit (Citizen Spring ASBL/VZW). Governance is sociocratic: your
                collective runs its own circle and makes its own decisions about how
                to spend the money it receives.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sponsor-invoice">
              <AccordionTrigger className="text-base">
                We have a sponsor. Can we send them a proper invoice?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Yes — that&apos;s one of the main reasons to have a fiscal host. We
                issue a proper invoice from Citizen Spring ASBL, with VAT applied when
                applicable.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="vat">
              <AccordionTrigger className="text-base">
                Do we have to pay VAT?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed space-y-3">
                <p>
                  If you provide a good or service in exchange for money, we must add
                  VAT to the invoices you issue through us. Your collective&apos;s
                  balance is credited with the amount <em>excluding</em> VAT (we
                  forward the VAT to the state).
                </p>
                <p>
                  Donations — unconditional support with no good or service in return
                  — are not subject to VAT.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="vat-back">
              <AccordionTrigger className="text-base">
                Can we get the VAT back on our expenses?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                Not directly — the admin overhead is too much for us at this stage.
                You submit expenses and get reimbursed. If we do end up reclaiming the
                VAT, it goes back into the commons (so you benefit indirectly).
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="expenses">
              <AccordionTrigger className="text-base">
                What expenses can we submit?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed space-y-3">
                <p>
                  Any valid expense directly related to your project — transport,
                  meals, consumables, consulting, online services, etc. A photo of a
                  receipt works as long as we can clearly see the place&apos;s name
                  and address, the date, and the items purchased. PDF invoices work
                  for online services.
                </p>
                <p>
                  Freelancers can issue an invoice addressed to:
                </p>
                <pre className="bg-muted/50 p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap">
{`[Collective Name]
Citizen Spring ASBL
Rue de Villers 12, 1000 Brussels
VAT: BE0804505132`}
                </pre>
                <p className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>
                    Every expense must be approved by at least one other person from
                    your collective.
                  </span>
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Apply */}
      <section
        id="apply"
        className="py-16 px-4 sm:px-6 lg:px-8 bg-background border-t border-border scroll-mt-20"
      >
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Apply for fiscal sponsorship
            </h2>
            <p className="text-muted-foreground">
              Tell us about your project and we&apos;ll get back to you. Make sure you
              meet the conditions above before applying.
            </p>
          </div>
          <FiscalSponsorshipForm />
        </div>
      </section>
    </main>
  );
}

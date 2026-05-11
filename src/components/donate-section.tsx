"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { CreditCard } from "lucide-react"

import { Button } from "@/components/ui/button"

const STRIPE_DONATION_URL = "https://buy.stripe.com/7sIdSnbxz7AE1bi28m"
const MOBILE_BREAKPOINT = 768

export function DonateSection() {
  const [decided, setDecided] = useState(false)

  useEffect(() => {
    if (window.innerWidth < MOBILE_BREAKPOINT) {
      window.location.replace(STRIPE_DONATION_URL)
      return
    }
    setDecided(true)
  }, [])

  if (!decided) return null

  return (
    <main className="min-h-screen">
      <section className="pt-32 pb-16 bg-primary/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground">
              Support Commons Hub Brussels
            </h1>
            <p className="mt-6 text-xl text-muted-foreground">
              Help us keep the Commons Hub open. Contribute to our costs.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-6">
          <div className="bg-card p-8 rounded-lg border border-border flex flex-col items-center text-center">
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Card or Bancontact
            </h2>
            <p className="text-muted-foreground mb-6">
              Donate online via Stripe with a credit card or Bancontact.
            </p>
            <Button asChild size="lg" className="mt-auto">
              <a
                href={STRIPE_DONATION_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <CreditCard className="w-5 h-5" />
                Donate online
              </a>
            </Button>
          </div>

          <div className="bg-card p-8 rounded-lg border border-border flex flex-col items-center text-center">
            <h2 className="text-2xl font-bold text-foreground mb-3">
              Bank transfer
            </h2>
            <p className="text-muted-foreground mb-6">
              Scan the QR code with your banking app to donate via SEPA
              transfer.
            </p>
            <Image
              src="/images/donate-qrcode.png"
              alt="QR code for donating via bank transfer"
              width={240}
              height={240}
              className="rounded-md"
            />
          </div>
        </div>
      </section>
    </main>
  )
}

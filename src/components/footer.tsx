import Link from "next/link";
import { Logo } from "./logo";
import { MapPin, Instagram, Linkedin, Twitter } from "lucide-react";
import settings from "@/settings/settings.json";
import { getAvailableYears } from "@/lib/reports";

const linkClass =
  "text-background/70 hover:text-background transition-colors text-sm";

export function Footer() {
  const availableYears = getAvailableYears().sort(
    (a, b) => parseInt(b) - parseInt(a)
  );

  return (
    <footer id="footer" className="bg-foreground text-background py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12">
          <div>
            <Link href="/" className="flex items-center gap-3 mb-4">
              <Logo className="w-10 h-10" />
              <span className="font-semibold text-lg">Commons Hub</span>
            </Link>
            <p className="text-background/70 text-sm mb-6">
              A collaborative space in Brussels where communities gather,
              create, and grow together.
            </p>
            <ul className="space-y-3 mb-6">
              <li className="text-background/70 text-sm">
                <a
                  href="mailto:hello@commonshub.brussels"
                  className="hover:text-background transition-colors"
                >
                  hello@commonshub.brussels
                </a>
              </li>
              <li className="flex items-start gap-2 text-background/70 text-sm">
                <MapPin className="w-4 h-4 mt-0.5" />
                <a
                  href="https://map.commonshub.brussels"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-background transition-colors"
                >
                  Rue de la Madeleine 51, 1000 Brussels
                </a>
              </li>
            </ul>
            <div className="flex items-center gap-4">
              <a
                href={settings.socials.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="text-background/70 hover:text-background transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href={settings.socials.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-background/70 hover:text-background transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href={settings.socials.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="text-background/70 hover:text-background transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-4">What we offer</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/coworking" className={linkClass}>
                  Coworking
                </Link>
              </li>
              <li>
                <Link href="/rooms" className={linkClass}>
                  Event space
                </Link>
              </li>
              <li>
                <Link href="/fiscal-sponsorship" className={linkClass}>
                  Fiscal Sponsorship
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Events</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/#events" className={linkClass}>
                  Upcoming events
                </Link>
              </li>
              <li>
                <Link href="/workshops" className={linkClass}>
                  Workshops
                </Link>
              </li>
              <li>
                <Link href="/potluck" className={linkClass}>
                  Potluck
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Community</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/#about" className={linkClass}>
                  About
                </Link>
              </li>
              <li>
                <Link href="/community" className={linkClass}>
                  Community
                </Link>
              </li>
              <li>
                <Link href="/volunteer" className={linkClass}>
                  Volunteer
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Activity Reports</h3>
            <ul className="space-y-2">
              {availableYears.map((year) => (
                <li key={year}>
                  <Link href={`/${year}`} className={linkClass}>
                    {year}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-background/20 text-center text-sm text-background/50">
          <p>
            <span className="-scale-x-100 inline-block">©</span>copyleft{" "}
            {new Date().getFullYear()} Commons Hub Brussels. Feel free to copy
            us.
          </p>
        </div>
      </div>
    </footer>
  );
}

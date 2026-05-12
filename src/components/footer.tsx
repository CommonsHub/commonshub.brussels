import Link from "next/link";
import { Logo } from "./logo";
import { Mail, MapPin, Instagram, Linkedin, Twitter } from "lucide-react";
import settings from "@/settings/settings.json";
import { getAvailableYears } from "@/lib/reports";

export function Footer() {
  const availableYears = getAvailableYears().sort(
    (a, b) => parseInt(b) - parseInt(a)
  );

  return (
    <footer id="footer" className="bg-foreground text-background py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
          <div>
            <Link href="/" className="flex items-center gap-3 mb-4">
              <Logo className="w-10 h-10" />
              <span className="font-semibold text-lg">Commons Hub</span>
            </Link>
            <p className="text-background/70 text-sm">
              A collaborative space in Brussels where communities gather,
              create, and grow together.
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/#events"
                  className="text-background/70 hover:text-background transition-colors text-sm"
                >
                  Events
                </Link>
              </li>
              <li>
                <Link
                  href="/workshops"
                  className="text-background/70 hover:text-background transition-colors text-sm"
                >
                  Workshops
                </Link>
              </li>
              <li>
                <Link
                  href="/#book"
                  className="text-background/70 hover:text-background transition-colors text-sm"
                >
                  Book Space
                </Link>
              </li>
              <li>
                <Link
                  href="/members"
                  className="text-background/70 hover:text-background transition-colors text-sm"
                >
                  Community
                </Link>
              </li>
              <li>
                <Link
                  href="/finance"
                  className="text-background/70 hover:text-background transition-colors text-sm"
                >
                  Finances
                </Link>
              </li>
              <li>
                <Link
                  href="/volunteer"
                  className="text-background/70 hover:text-background transition-colors text-sm"
                >
                  Volunteer
                </Link>
              </li>
              <li>
                <a
                  href="https://paragraph.com/@commonshub_bxl?modal=subscribe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-background/70 hover:text-background transition-colors text-sm"
                >
                  Newsletter
                </a>
              </li>

              <li>
                <Link
                  href="/#about"
                  className="text-background/70 hover:text-background transition-colors text-sm"
                >
                  About
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-background/70 hover:text-background transition-colors text-sm"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Activity Reports</h3>
            <ul className="space-y-2">
              {availableYears.map((year) => (
                <li key={year}>
                  <Link
                    href={`/${year}`}
                    className="text-background/70 hover:text-background transition-colors text-sm"
                  >
                    {year}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-4">Contact</h3>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-2 text-background/70 text-sm">
                <Mail className="w-4 h-4" />
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

            <h3 className="font-semibold mb-4">Follow Us</h3>
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

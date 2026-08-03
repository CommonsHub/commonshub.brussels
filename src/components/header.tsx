"use client";

import Link from "next/link";
import { Logo } from "./logo";
import { Button } from "@/components/ui/button";
import { AuthButton } from "@/components/auth-button";
import { NostrOutboxBadge } from "@/components/nostr-outbox-badge";
import { Menu, X, LogOut, Coins } from "lucide-react";
import { useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { getDisplayRoles } from "@/lib/roles";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: session } = useSession();
  const { balance } = useTokenBalance();

  // Get filtered roles to display
  const displayRoles = getDisplayRoles(session?.user?.roleDetails || []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <Logo className="w-10 h-10" />
            <span className="font-semibold text-lg text-foreground">
              Commons Hub
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/#events"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Events
            </Link>
            <Link
              href="/coworking"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Coworking
            </Link>
            <Link
              href="/community"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Community
            </Link>
            <Link
              href="https://paragraph.com/@commonshub_bxl?modal=subscribe"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Newsletter
            </Link>
            <Link
              href="/contact"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="outline" asChild>
              <Link href="/donate">Donate</Link>
            </Button>
            <Button asChild>
              <Link href="/rooms">Book Space</Link>
            </Button>
            <NostrOutboxBadge />
            <AuthButton />
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-background border-b border-border">
          <nav className="flex flex-col px-4 py-4 gap-4">
            <Link
              href="/#events"
              className="text-muted-foreground hover:text-foreground transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Events
            </Link>
            <Link
              href="/coworking"
              className="text-muted-foreground hover:text-foreground transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Coworking
            </Link>
            <Link
              href="/community"
              className="text-muted-foreground hover:text-foreground transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Community
            </Link>
            <Link
              href="https://paragraph.com/@commonshub_bxl?modal=subscribe"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Newsletter
            </Link>
            <Link
              href="#footer"
              className="text-muted-foreground hover:text-foreground transition-colors py-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              Contact
            </Link>
            <div className="flex flex-col gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                asChild
                className="w-full bg-transparent"
              >
                <Link href="/donate">Donate</Link>
              </Button>
              <Button asChild className="w-full">
                <Link href="/rooms">Book Space</Link>
              </Button>

              {/* Auth section for mobile */}
              {session?.user ? (
                <div className="flex flex-col gap-3 pt-2">
                  <Link
                    href={`/members/${session.user.username}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted hover:bg-accent transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Avatar className="w-10 h-10">
                      <AvatarImage
                        src={
                          session.user.avatar
                            ? `https://cdn.discordapp.com/avatars/${session.user.discordId}/${session.user.avatar}.png`
                            : undefined
                        }
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {session.user.username?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium text-sm truncate">
                        {session.user.username}
                      </p>

                      {/* CHT Balance */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Coins className="w-3.5 h-3.5" />
                        <span>
                          {balance !== null ? `${balance} CHT` : "..."}
                        </span>
                      </div>

                      {/* Roles */}
                      {displayRoles.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {displayRoles.map((role) => (
                            <span
                              key={role.id}
                              className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                            >
                              {role.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => signOut()}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign out
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => signIn("discord")}
                >
                  Login with Discord
                </Button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

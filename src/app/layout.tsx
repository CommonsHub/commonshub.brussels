import type React from "react";
import type { Metadata, Viewport } from "next";
import { DM_Sans, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SessionProvider } from "@/components/session-provider";
import { NostrProvider } from "@/components/nostr-provider";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { auth } from "@/auth";
import "./globals.css";

const dmSans = DM_Sans({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Commons Hub Brussels",
  description:
    "A common space for your community to meet, dream and work. A space to rediscover the commons. Come visit us in front of Central Station.",
  generator: "xavier@commonshub.brussels",
  icons: {
    icon: [
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/favicon.png",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // Enable safe area insets on iOS
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en">
      <head>
        <link rel="help" href="/llms.txt" type="text/plain" title="LLM-friendly site overview" />
        <link rel="alternate" href="/about.md" type="text/markdown" title="About Commons Hub Brussels" />
        <link rel="alternate" href="/events.md" type="text/markdown" title="Upcoming Events" />
        <link rel="alternate" href="/rooms.md" type="text/markdown" title="Available Rooms" />
        <link rel="alternate" href="/sitemap.md" type="text/markdown" title="Sitemap (Markdown)" />
        <link rel="alternate" href="/DATA.md" type="text/markdown" title="Data API Documentation" />
      </head>
      <body className={`font-sans antialiased`}>
        <SessionProvider session={session}>
          <NostrProvider>
            <Header />
            <main className="min-h-screen pt-16">{children}</main>
            <Footer />
          </NostrProvider>
        </SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}

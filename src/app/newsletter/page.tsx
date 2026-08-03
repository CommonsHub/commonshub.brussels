"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Mail, Calendar } from "lucide-react";
import Image from "@/components/optimized-image";
import Link from "next/link";
import useSWR from "swr";
import { Logo } from "@/components/logo";
import { getProxiedImageUrl } from "@/lib/image-proxy";

interface NewsletterIssue {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  coverImage?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function NewsletterPage() {
  const { data, isLoading } = useSWR<{
    issues: NewsletterIssue[];
    subscribeUrl: string;
  }>("/api/newsletter?all=true", fetcher);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="h-8 w-8" />
            <span className="font-semibold text-foreground">Commons Hub</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <Link
              href="/community"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Community
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Mail className="h-4 w-4" />
            Newsletter
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 text-balance">
            Stay Updated with Commons Hub
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 text-pretty">
            Get the latest news, events, and stories from our community
            delivered straight to your inbox.
          </p>
          <Button asChild size="lg" className="cursor-pointer">
            <a
              href={
                data?.subscribeUrl || "https://paragraph.xyz/@commonshub_bxl"
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              Subscribe to Newsletter
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      {/* Past Issues */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8">
            Past Issues
          </h2>

          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden animate-pulse">
                  <div className="aspect-video bg-muted" />
                  <CardContent className="p-6">
                    <div className="h-4 bg-muted rounded w-1/3 mb-3" />
                    <div className="h-6 bg-muted rounded w-full mb-2" />
                    <div className="h-4 bg-muted rounded w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {data?.issues.map((issue, index) => (
                <a
                  key={index}
                  href={issue.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group"
                >
                  <Card className="overflow-hidden h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                    {issue.coverImage && (
                      <div className="aspect-video relative overflow-hidden bg-muted">
                        <Image
                          src={
                            getProxiedImageUrl(issue.coverImage, "md", { relative: true }) ||
                            "/placeholder.svg"
                          }
                          alt={issue.title}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    )}
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                        <Calendar className="h-4 w-4" />
                        {formatDate(issue.pubDate)}
                      </div>
                      <h3 className="font-semibold text-foreground mb-2 group-hover:text-primary transition-colors line-clamp-2">
                        {issue.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {issue.description}
                      </p>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          )}

          {/* Subscribe CTA */}
          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">
              Want to receive future updates?
            </p>
            <Button
              asChild
              variant="outline"
              className="cursor-pointer bg-transparent"
            >
              <a
                href={
                  data?.subscribeUrl || "https://paragraph.xyz/@commonshub_bxl"
                }
                target="_blank"
                rel="noopener noreferrer"
              >
                Subscribe Now
                <Mail className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} Commons Hub Brussels. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

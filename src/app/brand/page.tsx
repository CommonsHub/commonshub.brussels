import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Brand Kit | Commons Hub Brussels",
  description:
    "Logo files, colors, typography, assets, and design guidance for Commons Hub Brussels.",
  openGraph: {
    title: "Commons Hub Brussels Brand Kit",
    description:
      "Use these assets and guidelines to make Commons Hub Brussels materials feel consistent and on brand.",
    images: ["https://commonshub.brussels/brandkit/commonshub_cover-1500x500.jpeg"],
  },
};

const colors = [
  {
    name: "Commons Orange",
    hex: "#FF4C02",
    use: "Primary brand signal, icon background, highlights, calls to action.",
  },
  {
    name: "Commons Cream",
    hex: "#FBF4F2",
    use: "Icon mark, warm surfaces, soft backgrounds, reverse logo details.",
  },
  {
    name: "Commons Ink",
    hex: "#001309",
    use: "Logo wordmark, headlines, high-contrast text, serious editorial tone.",
  },
  {
    name: "Warm Page",
    hex: "#FAF4EF",
    use: "Default website background. Use instead of stark white.",
  },
  {
    name: "Earth Text",
    hex: "#2B1E1C",
    use: "Primary body copy and UI text.",
  },
  {
    name: "Soft Clay",
    hex: "#EFE2D8",
    use: "Secondary bands, subtle grouped areas, quiet navigation surfaces.",
  },
  {
    name: "Muted Stone",
    hex: "#60514F",
    use: "Captions, metadata, helper text.",
  },
  {
    name: "Teal Accent",
    hex: "#009689",
    use: "Financial or systems accents when orange would be too loud.",
  },
  {
    name: "Deep Teal",
    hex: "#104E64",
    use: "Charts, secondary emphasis, analytical visuals.",
  },
  {
    name: "Token Gold",
    hex: "#FFB900",
    use: "Commons Hub Token, contribution, and value-flow moments.",
  },
] as const;

const logoAssets = [
  {
    name: "Primary logo",
    file: "commonshub-logo.svg",
    href: "/brandkit/commonshub-logo.svg",
    note: "Use when there is enough horizontal room.",
  },
  {
    name: "Icon mark",
    file: "commonshub-icon.svg",
    href: "/brandkit/commonshub-icon.svg",
    note: "Use for avatars, app icons, favicons, and compact placements.",
  },
  {
    name: "Favicon SVG",
    file: "chb-favicon.svg",
    href: "/brandkit/chb-favicon.svg",
    note: "Small browser and metadata icon.",
  },
  {
    name: "Sticker logo",
    file: "commonshub-logo-sticker.png",
    href: "/brandkit/commonshub-logo-sticker.png",
    note: "Rounded sticker treatment for social and print materials.",
  },
] as const;

const imageAssets = [
  {
    name: "Wide cover",
    file: "commonshub_cover-1500x500.jpeg",
    href: "/brandkit/commonshub_cover-1500x500.jpeg",
    type: "image",
  },
  {
    name: "Twitter cover",
    file: "chb-Twitter Cover _ 08.jpg",
    href: "/brandkit/chb-Twitter%20Cover%20_%2008.jpg",
    type: "image",
  },
  {
    name: "Banner photo",
    file: "chb banner.jpg",
    href: "/brandkit/chb%20banner.jpg",
    type: "image",
  },
  {
    name: "Print sticker",
    file: "CHB_sticker for print.png",
    href: "/brandkit/CHB_sticker%20for%20print.png",
    type: "image",
  },
  {
    name: "Printed banner PDF",
    file: "Commons Hub Brussels Banner 400x80cm.pdf",
    href: "/brandkit/banner/Commons%20Hub%20Brussels%20Banner%20400x80cm.pdf",
    type: "pdf",
  },
  {
    name: "Printed banner SVG",
    file: "Commons Hub Brussels banner.svg",
    href: "/brandkit/banner/Commons%20Hub%20Brussels%20banner.svg",
    type: "image",
  },
] as const;

const principles = [
  "Lead with the real place, people, community activity, transparent finance, or shared resources.",
  "Use warm backgrounds, direct language, compact information, and visible data when relevant.",
  "Keep orange as a strong signal, not a full-page wash. Pair it with cream, ink, and quiet earth tones.",
  "Prefer practical, human, civic, and cooperative visuals over generic startup or crypto aesthetics.",
  "Use the icon mark as a living commons symbol: simple, bold, circular, and highly recognizable.",
] as const;

const avoid = [
  "Do not recolor, stretch, rotate, outline, or add shadows to the logo.",
  "Do not place the ink wordmark on dark, busy, or low-contrast backgrounds.",
  "Avoid glossy Web3 styling, neon gradients, luxury real-estate moodboards, and generic stock photography.",
  "Avoid making everything orange. The brand should feel warm and grounded, not loud.",
] as const;

function AssetButton({ href, label }: { href: string; label: string }) {
  return (
    <Button asChild variant="outline" size="sm" className="gap-2">
      <a href={href} download>
        <Download className="h-4 w-4" />
        {label}
      </a>
    </Button>
  );
}

function AssetPreview({
  asset,
}: {
  asset: (typeof imageAssets)[number];
}) {
  if (asset.type === "pdf") {
    return (
      <object
        data={asset.href}
        type="application/pdf"
        className="h-full w-full rounded-md bg-[#FBF4F2]"
        aria-label={`${asset.name} preview`}
      >
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          PDF preview unavailable
        </div>
      </object>
    );
  }

  return (
    <img
      src={asset.href}
      alt={`${asset.name} preview`}
      className="h-full w-full rounded-md object-contain"
    />
  );
}

export default function BrandPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-linear-to-b from-primary/10 to-background">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_420px] lg:items-center">
            <div className="max-w-3xl">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Brand kit
              </p>
              <h1 className="mb-6 text-4xl font-bold text-foreground md:text-6xl">
                Commons Hub Brussels
              </h1>
              <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
                A practical guide for designing pages, posts, reports, slides,
                print materials, and generated visuals that feel like Commons
                Hub Brussels: warm, civic, transparent, useful, and alive.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <AssetButton
                  href="/brandkit/commonshub-logo.svg"
                  label="Logo SVG"
                />
                <AssetButton
                  href="/brandkit/commonshub-icon.svg"
                  label="Icon SVG"
                />
                <Button asChild size="sm" className="gap-2">
                  <Link href="#llm-brief">
                    LLM brief
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
              <div className="mb-8 rounded-md bg-[#FBF4F2] p-8">
                <img
                  src="/brandkit/commonshub-logo.svg"
                  alt="Commons Hub Brussels logo"
                  className="h-auto w-full"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {colors.slice(0, 3).map((color) => (
                  <div key={color.hex}>
                    <div
                      className="mb-2 aspect-square rounded-md border border-border"
                      style={{ backgroundColor: color.hex }}
                    />
                    <p className="text-xs font-semibold">{color.hex}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mb-8 max-w-3xl">
            <h2 className="text-3xl font-bold text-foreground">Core Assets</h2>
            <p className="mt-3 text-muted-foreground">
              Use the primary wordmark for most branded materials. Use the icon
              only when the space is square, circular, or too small for the full
              wordmark.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {logoAssets.map((asset) => (
              <Card key={asset.href} className="overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg">{asset.name}</CardTitle>
                  <CardDescription>{asset.file}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex h-32 items-center justify-center rounded-md border border-border bg-[#FBF4F2] p-5">
                    <img
                      src={asset.href}
                      alt={asset.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <p className="min-h-10 text-sm text-muted-foreground">
                    {asset.note}
                  </p>
                  <AssetButton href={asset.href} label="Download" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/30 py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mb-8 max-w-3xl">
            <h2 className="text-3xl font-bold text-foreground">Color System</h2>
            <p className="mt-3 text-muted-foreground">
              The identity is anchored by orange, cream, and ink. The interface
              palette adds warm neutrals and a small set of analytical accents.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {colors.map((color) => (
              <Card key={color.hex} className="overflow-hidden">
                <div
                  className="h-24 border-b border-border"
                  style={{ backgroundColor: color.hex }}
                />
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{color.name}</CardTitle>
                  <CardDescription className="font-mono text-sm">
                    {color.hex}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{color.use}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-10 lg:grid-cols-[360px_1fr]">
            <div>
              <h2 className="text-3xl font-bold text-foreground">
                Typography
              </h2>
              <p className="mt-3 text-muted-foreground">
                The website uses DM Sans for almost everything and Geist Mono
                for code, hashes, file names, and data snippets.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>DM Sans</CardTitle>
                  <CardDescription>Primary interface typeface</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-5xl font-bold">Warm civic clarity</p>
                  <p className="mt-4 text-muted-foreground">
                    Use bold weight for headlines, medium weight for labels,
                    and regular weight for body copy.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="font-mono">Geist Mono</CardTitle>
                  <CardDescription>Technical and data typeface</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-3xl font-semibold">
                    DATA_DIR/2026/04
                  </p>
                  <p className="mt-4 text-muted-foreground">
                    Use mono sparingly for exact values, IDs, paths, and public
                    data references.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-muted/30 py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mb-8 max-w-3xl">
            <h2 className="text-3xl font-bold text-foreground">
              Image And Print Assets
            </h2>
            <p className="mt-3 text-muted-foreground">
              These files are available in{" "}
              <code className="rounded bg-background px-1.5 py-0.5 font-mono text-sm">
                public/brandkit
              </code>{" "}
              and can be used for social headers, event pages, stickers,
              banners, and print work.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {imageAssets.map((asset) => (
              <Card key={asset.href} className="overflow-hidden">
                <div className="flex h-44 items-center justify-center border-b border-border bg-[#FBF4F2] p-4">
                  <AssetPreview asset={asset} />
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">{asset.name}</CardTitle>
                  <CardDescription>{asset.file}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <AssetButton href={asset.href} label="Download" />
                  <Button asChild variant="ghost" size="sm" className="gap-2">
                    <a href={asset.href}>
                      Open
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Design Principles</CardTitle>
                <CardDescription>
                  What Commons Hub Brussels should feel like.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                  {principles.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Do Not</CardTitle>
                <CardDescription>
                  Common mistakes that make materials feel off brand.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                  {avoid.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-foreground" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="llm-brief" className="bg-[#001309] py-14 text-[#FBF4F2] md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
            <div>
              <h2 className="text-3xl font-bold">LLM Design Brief</h2>
              <p className="mt-3 text-[#FBF4F2]/75">
                Paste this into design or content prompts when generating
                Commons Hub Brussels materials.
              </p>
            </div>
            <div className="rounded-lg border border-[#FBF4F2]/15 bg-[#FBF4F2]/10 p-6">
              <p className="font-mono text-sm leading-7 text-[#FBF4F2]">
                Design for Commons Hub Brussels. Use a warm civic cooperative
                tone: practical, transparent, human, community-owned, and
                grounded in a real shared space in Brussels. Primary colors:
                #FF4C02 orange, #FBF4F2 cream, #001309 ink. Supporting colors:
                #FAF4EF warm page, #2B1E1C earth text, #EFE2D8 soft clay,
                #60514F muted stone, #009689 teal, #104E64 deep teal, #FFB900
                token gold. Use DM Sans for text and Geist Mono for exact data.
                Prefer real photos, public data, simple layouts, compact cards,
                useful labels, and clear calls to action. Avoid glossy startup,
                luxury, generic stock, neon Web3, and all-orange compositions.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

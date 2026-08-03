import { NextResponse } from "next/server";
import roomsData from "@/settings/rooms.json";
import partners from "@/settings/partners.json";

const BASE_URL = "https://commonshub.brussels";

export async function GET() {
  const roomsList = roomsData.rooms
    .map((r) => `- [${r.name}](${BASE_URL}/rooms/${r.slug}): ${r.shortDescription} (capacity: ${r.capacity})`)
    .join("\n");

  const partnersList = partners
    .filter((p: { featured?: boolean }) => p.featured)
    .map((p: { name: string; website: string; description: string }) => `- [${p.name}](${p.website}): ${p.description}`)
    .join("\n");

  const content = `# Commons Hub Brussels

> A common space for communities to meet, dream and work. A space to rediscover the commons.

Commons Hub Brussels is a community hub located at Rue de la Madeleine 51, 1000 Brussels, Belgium — right in front of Central Station. We provide infrastructure and support for communities to gather, collaborate, and thrive.

## Key Pages

- [About](${BASE_URL}/about.md): Detailed information about Commons Hub Brussels
- [Events](${BASE_URL}/events.md): Upcoming events at the Commons Hub
- [Rooms](${BASE_URL}/rooms.md): Available spaces for booking
- [Economy](${BASE_URL}/economy): Our community token economy (CHT)
- [Finance](${BASE_URL}/finance): Transparent community finances
- [Community](${BASE_URL}/community): Our community members
- [Workshops](${BASE_URL}/workshops): Workshop offerings
- [Contact](${BASE_URL}/contact): Get in touch
- [Apply](${BASE_URL}/apply): Apply for membership

## Rooms

${roomsList}

## Community Partners

${partnersList}

## Contact

- Email: hello@commonshub.brussels
- Address: Rue de la Madeleine 51, 1000 Brussels, Belgium
- Discord: https://discord.commonshub.brussels
- Instagram: https://www.instagram.com/commonshub_bxl/
- LinkedIn: https://be.linkedin.com/company/commonshub-brussels/
- X/Twitter: https://x.com/commonshub_bxl
`;

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}

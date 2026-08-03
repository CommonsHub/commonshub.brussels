import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowLeft, Heart, Coins } from "lucide-react";
import Link from "next/link";
import settings from "@/settings/settings.json";
import MemberNotFound from "./not-found";
import { resolveMessagesImages } from "@/lib/discord-image-resolver";
import { MemberBalance } from "@/components/member-balance";
import { MemberProfileContent } from "@/components/member-profile-content";
import fs from "fs";
import path from "path";

interface Contributor {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  contributionCount: number;
  joinedAt: string | null;
}

interface Contribution {
  content: string;
  timestamp: string;
  mentions: string[];
  attachments?: Array<{
    id: string;
    url: string;
    proxyUrl: string;
    contentType?: string;
  }>;
  author?: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
  };
  messageId: string;
  channelId?: string;
  reactions?: Array<{ emoji: string; count: number; me?: boolean }>;
}

interface Introduction {
  content: string;
  timestamp: string;
  attachments?: Array<{
    id: string;
    url: string;
    proxyUrl: string;
    contentType?: string;
  }>;
}

interface DiscordData {
  contributors: Contributor[];
  introductions: Record<string, Introduction[]>;
  contributions: Record<string, Contribution[]>;
  contributionsTotalCount?: Record<string, number>;
  userMap: Record<string, string>;
  channelMap: Record<string, string>;
}

const guildId = settings.discord.guildId;

async function getMemberData(username: string): Promise<{
  member: Contributor;
  introductions: Introduction[];
  contributions: Contribution[];
  totalContributions: number;
  imagesByMonth: Record<string, any[]>;
  userMap: Record<string, string>;
  channelMap: Record<string, string>;
} | null> {
  try {
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");

    // Read the profile file directly from filesystem
    const profilePath = path.join(dataDir, "generated", "profiles", `${username}.json`);

    if (!fs.existsSync(profilePath)) {
      console.error(`Profile not found for ${username}`);
      return null;
    }

    const profileData = fs.readFileSync(profilePath, "utf-8");
    const profile = JSON.parse(profileData);

    // Read contributors file to build userMap
    const contributorsPath = path.join(dataDir, "contributors.json");
    let userMap: Record<string, any> = {};

    if (fs.existsSync(contributorsPath)) {
      const contributorsData = JSON.parse(fs.readFileSync(contributorsPath, "utf-8"));
      userMap = Object.fromEntries(
        contributorsData.contributors.map((c: any) => [c.id, { username: c.username, displayName: c.displayName }])
      );
    }

    // Create member object from profile
    const member: Contributor = {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      avatar: profile.avatar,
      contributionCount: profile.contributionCount,
      joinedAt: profile.joinedAt,
    };

    return {
      member,
      introductions: profile.introductions || [],
      contributions: profile.contributions || [],
      totalContributions: profile.contributions?.length || 0,
      imagesByMonth: profile.imagesByMonth || {},
      userMap,
      channelMap: {},
    };
  } catch (error) {
    console.error("Failed to read member data:", error);
    return null;
  }
}

interface MemberPageProps {
  params: Promise<{ username: string }>;
}

// Force dynamic rendering - required because root layout uses auth() which reads cookies
export const dynamic = 'force-dynamic';


export default async function MemberProfilePage({ params }: MemberPageProps) {
  const { username } = await params;
  const data = await getMemberData(username);

  if (!data) {
    return <MemberNotFound />;
  }

  const {
    member,
    introductions,
    contributions,
    totalContributions,
    imagesByMonth,
    userMap,
    channelMap,
  } = data;

  // Resolve local image paths for all messages
  const resolvedIntroductions = resolveMessagesImages(introductions);
  const resolvedContributions = resolveMessagesImages(contributions);

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link
          href="/community"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Community
        </Link>

        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="flex flex-col items-center text-center mb-8">
            <Avatar className="w-32 h-32 mb-4 ring-4 ring-primary/20">
              <AvatarImage
                src={member.avatar || undefined}
                alt={member.displayName}
              />
              <AvatarFallback className="bg-primary text-primary-foreground text-4xl">
                {member.displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <h1 className="text-2xl font-bold text-foreground mb-1">
              {member.displayName}
            </h1>
            <p className="text-muted-foreground">@{member.username}</p>

            {member.joinedAt && (
              <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>
                  Member since{" "}
                  {new Date(member.joinedAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}

            <MemberBalance userId={member.id} />
          </div>

          <MemberProfileContent
            member={member}
            resolvedIntroductions={resolvedIntroductions}
            resolvedContributions={resolvedContributions}
            totalContributions={totalContributions}
            imagesByMonth={imagesByMonth}
            userMap={userMap}
            channelMap={channelMap}
            guildId={guildId}
          />

          <div className="mt-8 flex justify-center">
            <Button asChild variant="outline">
              <a
                href={settings.socials.discord}
                target="_blank"
                rel="noopener noreferrer"
              >
                Say Hi on Discord
              </a>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

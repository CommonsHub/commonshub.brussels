import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

const BASE_URL =
  process.env.BASE_URL || process.env.VERCEL_URL || "http://localhost:3000";
export const runtime = "nodejs";
export const alt = "Commons Hub Brussels - Our Community";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    return null;
  }
}

export default async function Image() {
  // Fetch contributors
  let contributors: any[] = [];
  try {
    const fs = await import("fs");
    const path = await import("path");
    const { DATA_DIR } = await import("@/lib/data-paths");
    const filePath = path.join(DATA_DIR, "latest", "generated", "contributors.json");
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      contributors = data.contributors || [];
    }
  } catch (error) {
    console.error("[OG Members] Error fetching contributors:", error);
  }

  // Get top contributors with avatars, already sorted by contribution
  const topContributors = contributors
    .filter((c) => c.avatar)
    .sort((a, b) => b.contributionCount - a.contributionCount)
    .slice(0, 48);

  // Fetch avatar images
  const avatarImages = await Promise.all(
    topContributors.map((c) => fetchImageAsBase64(c.avatar))
  );

  // Read background image
  const backgroundPath = join(
    process.cwd(),
    "public",
    "images",
    "ogimage-background.jpg"
  );
  const backgroundBuffer = await readFile(backgroundPath);
  const backgroundBase64 = backgroundBuffer.toString("base64");

  // Generate concentric circle positions around the center logo
  // Center of image: 600, 315
  // Logo size: 200px (radius 100px)
  const centerX = 600;
  const centerY = 315;
  const avatarSize = 90; // Same size for all
  const avatarRadius = avatarSize / 2;

  // Define circles with their radii and counts
  const circles = [
    { radius: 160, count: 6 }, // Circle 1 - top 6 contributors
    { radius: 240, count: 6 }, // Circle 2 - next 6 contributors
    { radius: 320, count: 6 }, // Circle 3 - next 6 contributors
    { radius: 390, count: 6 }, // Circle 4 - next 6 contributors (may be partially cropped)
  ];

  // Two sets of angles: odd circles use set A, even circles use set B
  const oddCircleAngles = [30, 90, 150, 210, 270, 330]; // Circle 1, 3
  const evenCircleAngles = [60, 120, 180, 240, 300, 0]; // Circle 2, 4 (midpoints of odd)

  // Calculate positions on concentric circles
  const bubblePositions: [string, string, number][] = [];
  const numAvatars = Math.min(avatarImages.length, 24);
  let avatarIndex = 0;

  for (let circleIdx = 0; circleIdx < circles.length; circleIdx++) {
    const circle = circles[circleIdx];
    if (avatarIndex >= numAvatars) break;

    const avatarsInThisCircle = Math.min(
      circle.count,
      numAvatars - avatarIndex
    );

    // Odd circles (0, 2) use oddCircleAngles, even circles (1, 3) use evenCircleAngles
    const angles = circleIdx % 2 === 0 ? oddCircleAngles : evenCircleAngles;

    // Place avatars at the angles for this circle
    for (let i = 0; i < avatarsInThisCircle; i++) {
      if (avatarIndex >= numAvatars) break;

      const angleDegrees = angles[i % angles.length];
      const angle = angleDegrees * (Math.PI / 180);

      // Calculate position
      const x = centerX + circle.radius * Math.cos(angle);
      const y = centerY + circle.radius * Math.sin(angle);

      // Check if avatar would be within bounds (with some margin)
      const wouldBeCropped =
        x - avatarRadius < 10 ||
        x + avatarRadius > 1190 ||
        y - avatarRadius < 10 ||
        y + avatarRadius > 620;

      // Skip positions that would be cropped
      if (!wouldBeCropped) {
        const left = x - avatarRadius;
        const top = y - avatarRadius;
        bubblePositions.push([`${left}px`, `${top}px`, avatarSize]);
        avatarIndex++;
      }
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Background Image - full */}
        <img
          src={`data:image/jpeg;base64,${backgroundBase64}`}
          alt=""
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />

        {/* Dark overlay for better contrast */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.15)",
          }}
        />

        {/* Spiral avatars - ordered by contribution */}
        {avatarImages.map((img, i) => {
          if (!img || i >= bubblePositions.length) return null;
          const [left, top, size] = bubblePositions[i];

          return (
            <div
              key={`avatar-${i}`}
              style={{
                position: "absolute",
                left,
                top,
                width: `${size}px`,
                height: `${size}px`,
                borderRadius: "50%",
                overflow: "hidden",
                display: "flex",
                backgroundColor: "transparent",
                zIndex: 5,
              }}
            >
              <img
                src={img}
                alt=""
                width={size}
                height={size}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          );
        })}

        {/* Center logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <svg width="200" height="200" viewBox="0 0 500 500">
            <g clipPath="url(#clip0_members)">
              <rect width="500" height="500" fill="#FF4C02" />
              <path
                d="M213.528 91L126.722 141.505L201.691 225.154L92 201.48V302.49L201.691 280.394L126.722 359.308L213.528 409.813L250.223 303.632L286.918 409.813L373.723 359.308L298.755 280.394L408.446 302.49V201.48L298.755 225.154L373.723 141.505L286.918 91L250.223 190.155L213.528 91Z"
                fill="#FBF4F2"
              />
            </g>
            <defs>
              <clipPath id="clip0_members">
                <rect width="500" height="500" rx="250" fill="white" />
              </clipPath>
            </defs>
          </svg>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

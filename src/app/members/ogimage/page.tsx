export default async function OGImageTestPage() {
  let contributors: any[] = []
  let totalMembers = 0

  try {
    const fs = await import("fs")
    const path = await import("path")
    const { DATA_DIR } = await import("@/lib/data-paths")
    const filePath = path.join(DATA_DIR, "latest", "generated", "contributors.json")
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"))
      contributors = data.contributors || []
      totalMembers = data.totalMembers || 0
    }
  } catch (error) {
    console.error("Error fetching contributors:", error)
  }

  const topContributors = contributors
    .filter((c) => c.avatar)
    .sort((a, b) => b.contributionCount - a.contributionCount)
    .slice(0, 24)

  const topAvatars = topContributors.slice(0, 12)
  const bottomAvatars = topContributors.slice(12, 24)

  return (
    <div className="w-full h-screen bg-black flex items-center justify-center relative overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-40"
        style={{ backgroundImage: "url(/images/ogimage-background.jpg)" }}
      />

      {/* Top row of avatars */}
      <div className="absolute top-4 left-0 right-0 flex justify-around px-8 z-20">
        {topAvatars.map((contributor, index) => (
          <div key={`top-${index}`} className="relative">
            <img
              src={contributor.avatar}
              alt={contributor.displayName}
              className="w-20 h-20 rounded-full border-2 border-orange-500 object-cover"
            />
            <div className="text-white text-xs text-center mt-1 max-w-[80px] truncate">
              {contributor.displayName}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom row of avatars */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-around px-8 z-20">
        {bottomAvatars.map((contributor, index) => (
          <div key={`bottom-${index}`} className="relative">
            <img
              src={contributor.avatar}
              alt={contributor.displayName}
              className="w-20 h-20 rounded-full border-2 border-orange-500 object-cover"
            />
            <div className="text-white text-xs text-center mt-1 max-w-[80px] truncate">
              {contributor.displayName}
            </div>
          </div>
        ))}
      </div>

      {/* Center content */}
      <div className="flex flex-col items-center z-10 bg-black/60 p-12 rounded-lg">
        {/* Logo */}
        <svg width="200" height="200" viewBox="0 0 500 500" className="mb-8">
          <g clipPath="url(#clip0_test)">
            <rect width="500" height="500" fill="#FF4C02" />
            <path
              d="M213.528 91L126.722 141.505L201.691 225.154L92 201.48V302.49L201.691 280.394L126.722 359.308L213.528 409.813L250.223 303.632L286.918 409.813L373.723 359.308L298.755 280.394L408.446 302.49V201.48L298.755 225.154L373.723 141.505L286.918 91L250.223 190.155L213.528 91Z"
              fill="#FBF4F2"
            />
          </g>
          <defs>
            <clipPath id="clip0_test">
              <rect width="500" height="500" rx="250" fill="white" />
            </clipPath>
          </defs>
        </svg>

        <h1 className="text-6xl font-bold text-white mb-4">Commons Hub Brussels</h1>
        <p className="text-3xl text-gray-400">Our Community</p>
        {totalMembers > 0 && (
          <p className="text-2xl text-orange-500 font-bold mt-4">{totalMembers} Active Members</p>
        )}
      </div>

      {/* Debug info */}
      <div className="absolute top-4 right-4 bg-black/80 text-white p-4 rounded text-sm">
        <div>Total Contributors: {contributors.length}</div>
        <div>With Avatars: {topContributors.length}</div>
        <div>Top Row: {topAvatars.length}</div>
        <div>Bottom Row: {bottomAvatars.length}</div>
      </div>
    </div>
  )
}

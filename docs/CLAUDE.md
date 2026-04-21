# General Purpose

This is a presentation website for the Commons Hub Brussels, a community space / members club in the heart of Brussels.

People who visit the website should
- See the upcoming events and quickly filter them by tags
- Be able to book a room to organise a meeting or an event
- Get an idea of what the commons are
- Apply to become a member

It should convey that it is a vibrant space with a lot of things happening.

## Rooms

Rooms are defined in `settings.json`. Each room has a Discord channel from which we fetch images, and a booking form.

# Technically

This is a mostly statically generated website.
It updates once an hour by running a cronjob to fetch the latest data from the different data sources.

The only dynamic part is the ability to login with Discord to
- show your current balance
- feature photos
- remove photos that you posted or where you are tagged

## Build Process

- `bun run build` - Compiles the Next.js application (does **not** fetch data)

### Data Fetching

Data fetching and generation are handled by an external data-sync process (separate repo), which writes into `DATA_DIR` (`~/.chb/data` by default). The website only reads from `DATA_DIR` — it does not fetch or generate data itself.

Layout written by the data-sync process:
- `DATA_DIR/latest/generated/{members,events,images,contributors,transactions}.json` — latest aggregated snapshots
- `DATA_DIR/:year/:month/generated/{images,events,transactions}.json` — per-month snapshots
- `DATA_DIR/:year/generated/images.json` — per-year aggregates

### Empty Data State

When the data directory is empty or has no data, the website displays a helpful error page explaining why data is needed. Implemented in `src/components/empty-data-state.tsx` and checked on the homepage via `src/lib/data-check.ts`.

## Data sources
(defined in `settings.json`)
- Stripe
- Blockchain
- Discord
- Nostr
- luma
- ics calendars

## Data structure
All the data is saved locally in the DATA_DIR (default to ./data).

This folder is structured in a human readable and usable way:
data/:year/:month/:dataSourceType/:dataSource/:account.json

Data that contains sensitive information are always stored within a `/private/` directory. E.g. `data/{year}/{month}/calendars/luma/private/guests/eventId.json`

Example tree structure:
```
data/
├── 2025/
│   ├── 12/
│   │   ├── finance/
│   │   │   ├── stripe/
│   │   │   │   └── acct_1Nn0FaFAhaWeDyow.json
│   │   │   ├── gnosis/
│   │   │   │   ├── savings.EURe.json
│   │   │   │   ├── checking.EURe.json
│   │   │   │   ├── fridge.EURb.json
│   │   │   │   └── coffee.EURb.json
│   │   │   └── celo/
│   │   │       └── cht.json
│   │   ├── discord/
│   │   │   ├── 1280532849287495726/  (channel: general)
│   │   │   │   ├── messages.json
│   │   │   │   └── images.json
│   │   │   ├── 1297965144579637248/  (channel: contributions)
│   │   │   │   ├── messages.json
│   │   │   │   └── images.json
│   │   │   └── images/
│   │   │       └── [cached image files]
│   │   ├── calendars/
│   │   │   ├── ics/
│   │   │   │   ├── google.ics
│   │   │   │   ├── luma.ics
│   │   │   │   └── images/
│   │   │   └── luma/
│   │   │       ├── cal-kWlIiw3HsJFhs25.json
│   │   │       ├── images/
│   │   │       │   └── [event cover images]
│   │   │       └── private/
│   │   │           └── guests/
│   │   │               └── evt-*.json
│   │   ├── events.json           (generated)
│   │   ├── transactions.json     (generated)
│   │   └── counterparties.json   (generated)
│   └── [other months...]
├── generated/
│   └── profiles/
│       └── [username].json
└── tmp/
    └── [resized image cache]
```

The build and cronjob fetch scripts automatically skip months that already have cached data, keeping operations fast and efficient.

## Data processing

We generate aggregated data to make it easier to generate the various different views (pages).

### Generated files per month (data/{year}/{month}/)

1. **transactions.json** - Aggregated financial transactions from all sources
   - Combines Stripe payments, blockchain transactions (Gnosis, Celo)
   - Normalized format with: date, amount, currency, counterparty, description, type, source
   - Used for financial reports and transaction history pages

2. **counterparties.json** - List of unique transaction counterparties
   - Extracted from all transactions
   - Includes names, types (person, organization, etc.)
   - Used for filtering and analytics

3. **events.json** - Consolidated events from all calendars
   - Merges Luma (ICS + API), Google Calendar, and other .ics sources
   - Includes metadata: title, description, dates, location, cover image, attendee count
   - Deduplicates events that appear in multiple sources
   - Fetches og:image for events without cover images

4. **discord/images.json** - All images posted in Discord for that month
   - Aggregates images from all configured Discord channels
   - Includes author info, timestamp, reactions, message context
   - Used for photo galleries and activity displays

### Global generated files (data/generated/)

1. **profiles/{username}.json** - User profiles
   - Generated for active contributors based on Discord activity
   - Includes display name, avatar, contribution stats, tokens received

2. **activitygrid.json** - Activity heatmap data
   - Shows contribution patterns by year/month
   - Used for activity visualization

3. **contributors.json** - Top contributors summary
   - Based on most recent 3 months of Discord activity
   - Includes contribution counts and token allocations

## Calendars

We support luma calendars and any .ics url.
We fetch automatically all entries and for each, we fetch the cover image or og:image.

## Image processing

There is an image proxy that on-demand resizes images and caches them in `data/tmp/`.

### Image sizes
- **xs**: 320px width
- **sm**: 640px width
- **md**: 1024px width
- **lg**: 1920px width

### Image proxy endpoints

1. **/api/image-proxy** - Proxies local `/data/...` files and allowed external images
   - Query params: `url` (required), `size` (optional: xs|sm|md|lg)
   - Example: `/api/image-proxy?url=https://example.com/image.jpg&size=md`
   - Example: `/api/image-proxy?url=/data/2026/04/channels/discord/images/123.jpg&size=sm`
   - Caches resized versions as `{imageId}-{size}.jpg` in `data/tmp/`

### Processing
- Uses Sharp library for image resizing
- Converts all images to JPEG (quality: 85)
- Maintains aspect ratio with "fit inside" strategy
- Never enlarges smaller images
- Cache duration: 24 hours

## Forms

All forms ask for the email address of the sender. Once sent, a confirmation email is sent to the sender using the RESEND api. 
A new thread in the "requests" channel is also created on Discord.

## Libraries

### Core Framework
- **Next.js 16** - React framework with App Router and server components
- **React 19** - UI library
- **TypeScript** - Type safety

### Styling
- **Tailwind CSS 4** - Utility-first CSS framework
- **Shadcn** - component primitives
- **Lucide React** - Icon library

### Blockchain
- **Viem** - TypeScript interface for Ethereum (used for Gnosis chain interactions)

### Data Fetching & State
- **SWR** - React Hooks for data fetching with caching
- **Next-Auth** - Authentication (Discord OAuth)

### Image Processing
- **Sharp** - High-performance image resizing and optimization

### Forms & Validation
- **React Hook Form** - Form state management
- **Zod** - Schema validation

### Email
- **Resend** - Email API for form confirmations

### Calendar Processing
- **node-ical** - iCalendar (ICS) parser

### Other Utilities
- **open-graph-scraper** - Fetches og:image and metadata from event URLs

## APIs

- Etherscan to fetch blockchain transactions
- Discord to fetch messages from predefined channel ids.

## Components

### ImageLightbox

A full-screen image viewer with navigation and social features.

**Responsibilities:**
- Display images in a modal dialog with full-screen view
- Navigate between images with keyboard (←/→), swipe gestures, or on-screen buttons
- Show image metadata: author, timestamp, message
- Support reactions (favorite/like) for authenticated users
- Allow image removal by author or admins
- Open original image in new tab

**Input:**
```tsx
interface ImageLightboxProps {
  images: ImagePost[]           // Array of images to display
  initialIndex?: number         // Starting image index
  showMessage?: boolean         // Show message text below image
  userMap?: Record<string, ...> // User info for display names
  channelMap?: Record<...>      // Channel names
  guildId?: string              // Discord guild ID for actions
}
```

**Output:**
- Renders a Dialog component with navigation controls
- Emits events when favorite/remove actions are performed
- Can be controlled via ref: `openImage(index)`

**Usage:**
```tsx
const lightboxRef = useRef<ImageLightboxHandle>(null)
<ImageLightbox ref={lightboxRef} images={images} />
```

### DiscordImageGallery

A responsive grid gallery of images from Discord messages.

**Responsibilities:**
- Display thumbnails in a responsive grid layout
- Load images through the image proxy with appropriate sizing
- Handle image loading errors with fallback to original URLs
- Open full-screen lightbox when thumbnail is clicked
- Show author avatar overlay on thumbnails
- Support different thumbnail sizes (sm, md, lg)

**Input:**
```tsx
interface DiscordImageGalleryProps {
  images: ImagePost[]            // Images to display
  showMessage?: boolean          // Show message in lightbox
  thumbnailSize?: "sm"|"md"|"lg" // Grid density
  userMap?: Record<...>          // User display names
  channelMap?: Record<...>       // Channel names
  guildId?: string               // For lightbox actions
}
```

**Output:**
- Renders a responsive grid of image thumbnails
- Opens ImageLightbox when thumbnail is clicked

**Usage:**
```tsx
<DiscordImageGallery
  images={images}
  thumbnailSize="md"
  showMessage={true}
/>
```

**Grid layout:**
- **sm**: 4-6-8 columns (mobile-tablet-desktop)
- **md**: 3-6 columns (default)
- **lg**: 2-4 columns

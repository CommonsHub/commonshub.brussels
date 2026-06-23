# Commons Hub Brussels

A community space website showcasing events, members, and collaborative activities at the Commons Hub Brussels.

🌐 **Live Site:** https://commonshub.brussels
🧪 **Test Version:** https://v0.commonshub.brussels

## Overview

This is a mostly statically generated Next.js website that fetches data from various sources (Discord, Stripe, blockchain, calendars) and displays community activity, financial transparency, and upcoming events.

## Quick Start

### Using Quick Start Script (Recommended)

```bash
# Make script executable (first time only)
chmod +x scripts/quick-start.sh

# Run the quick start script
./scripts/quick-start.sh
```

The script will guide you through:
1. Setting up environment variables
2. Building the Docker images
3. Fetching data
4. Starting the services

### Manual Setup

```bash
# 1. Copy environment variables
cp .env.example .env
# Edit .env and add your API keys

# 2. Populate ./data with the chb pipeline (run separately)
#    The website only reads this directory; it does not fetch data.

# 3. Build and start the website
docker compose -f docker-compose.yml.example up -d --build

# 4. Open the website
open http://localhost:3000
```

**Note:** For Coolify, deploy the single `web` container directly from [`Dockerfile`](Dockerfile) — see [docs/coolify.md](docs/coolify.md). There is no compose file or persistent volume; the dataset is baked into the image at build time.

## Development

### Local Development without Docker

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys

# Data is populated by the external data-sync process into DATA_DIR (~/.chb/data).

# Start development server
bun run dev
```

## Data Fetching

The website reads pre-generated files from `./data`. Populating that directory is a separate concern handled by the standalone `chb` pipeline (run from its own repo), which writes into `DATA_DIR`. The website never fetches data itself.

- **`chb sync`** - Fetches the latest data and regenerates derived files
- **`chb sync --history`** - Backfills historical data and regenerates derived files

### Data Sources

Data is fetched from:
- **Discord** - Community messages and photos
- **Stripe** - Payment transactions
- **Blockchain** - Token transactions (via Etherscan)
- **Luma** - Event calendar
- **ICS Calendars** - Additional calendar integrations

All fetched data is cached in the `./data` directory to avoid redundant API calls.

## Build

Build the production application:

```bash
bun run build
```

**Note:** The build process only compiles the Next.js application. It does **not** fetch data. The `./data` directory must be populated by the chb pipeline (run separately) before the site has anything to show.

### Fetching Data

Run the chb pipeline from its own repo to write into `DATA_DIR`:

```bash
# Latest data
chb sync

# Or full history
chb sync --history
```

For Coolify, the dataset is baked into the image at build time; redeploy to publish refreshed data. See [docs/coolify.md](docs/coolify.md).

If the data directory is empty, the website will display a helpful empty data state page with fetching instructions.

## Status

- **`/status`** - HTML page showing application status, git info, and uptime
- **`/status.json`** - JSON API for programmatic access

## Documentation

- **[Deployment Guide](docs/deployment.md)** - Complete Docker deployment instructions
- **[Coolify Guide](docs/coolify.md)** - Single-container Coolify deployment from the Dockerfile
- **[Webhook Setup](docs/WEBHOOK_SETUP.md)** - Automated deployment via GitHub webhooks
- **[CLAUDE.md](CLAUDE.md)** - Technical architecture and component documentation

## Project Structure

```
├── src/
│   ├── app/              # Next.js app router pages
│   ├── components/       # React components
│   ├── lib/              # Utility libraries
│   └── settings/         # Configuration files
├── scripts/              # Operational scripts (status check, verification)
├── data/                 # Cached data directory (gitignored)
├── docs/                 # Documentation
└── public/               # Static assets
```

## Scripts and Commands

| Command | Description |
|--------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Build the production app |
| `chb sync` | Fetch latest data + auto-generate derived files (external data-sync process) |
| `chb sync --history` | Fetch full history + auto-generate derived files (external data-sync process) |
| `bun run restart` | Restart the systemd service |
| `bun run logs` | View application logs (last 100 lines + follow) |
| `bun run status` | Check application status, git info, and uptime |

## Environment Variables

See `.env.example` for required environment variables. Key variables include:
- Discord bot token and OAuth credentials
- Stripe API key
- Etherscan API key
- Luma API key
- NextAuth secret

## Contributing

Contributions are welcome! Please ensure:
- Code follows existing patterns
- Tests pass
- No sensitive data is committed

## License

[Add license information]

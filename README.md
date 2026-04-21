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

# 2. Build and start both services
docker compose -f docker-compose.yml.example up -d --build

# 3. Populate the shared data directory from the CLI service
docker compose -f docker-compose.yml.example run --rm chbcli chb sync

# 4. Open the website
open http://localhost:3000
```

**Note:** Local Docker now uses a single compose file with both `web` and `chbcli`. For Coolify, use [docs/coolify.md](docs/coolify.md) with [docker-compose.coolify.yml](docker-compose.coolify.yml).

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

The website reads pre-generated files from `./data`. Populate that directory with the standalone `chb` CLI, usually from the `chbcli` service in `docker-compose.yml.example`, or from the `chbcli` service in the Coolify compose setup.

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

**Note:** The build process only compiles the Next.js application. It does **not** fetch data. When using Docker with a mounted data volume, data must be fetched after the container starts.

### Fetching Data

After building and starting the application:

```bash
# Local Docker: fetch the latest data from the CLI service
docker compose -f docker-compose.yml.example run --rm chbcli chb sync

# Or fetch full history
docker compose -f docker-compose.yml.example run --rm chbcli chb sync --history
```

For Coolify, run the same commands inside the `chbcli` service terminal. See [docs/coolify.md](docs/coolify.md).

If the data directory is empty, the website will display a helpful empty data state page with fetching instructions.

## Status

- **`/status`** - HTML page showing application status, git info, and uptime
- **`/status.json`** - JSON API for programmatic access

## Documentation

- **[Deployment Guide](docs/deployment.md)** - Complete Docker deployment instructions
- **[Coolify Guide](docs/coolify.md)** - Single-resource Coolify deployment with shared persistent volume
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

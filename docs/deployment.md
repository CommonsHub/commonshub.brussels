# Deployment Guide

The website deploys as a single container that serves the Next.js site and
reads pre-generated data from `DATA_DIR` (defaults to `/data`). It never fetches
data itself — the standalone `chb` pipeline (run from its own repo) populates the
data directory.

## Files

- `Dockerfile.web` builds the website image
- `docker-compose.yml.example` is the local Docker setup for the `web` container
- Coolify deploys the `web` container directly from `Dockerfile.web` (no compose file)

## Local Docker

### 1. Prepare Environment Variables

```bash
cp .env.example .env
```

Set the values you need in `.env`.

### 2. Populate the Data Directory

The website reads `./data` but does not generate it. Run the chb pipeline (from
its own repo) to write the dataset into `./data` before starting the site:

```bash
chb sync
```

For a full backfill instead:

```bash
chb sync --history
```

### 3. Start the Website

```bash
docker compose -f docker-compose.yml.example up -d --build
```

This starts `web` on `http://localhost:3000`.

### 4. Open the Website

```bash
open http://localhost:3000
```

If `./data` is empty, the site shows the empty-data state until you populate it.

### Local Persistence

The local compose file bind-mounts `./data` into the `web` container read-only,
so the generated files on your machine stay available across restarts and
rebuilds.

### Local Verification

```bash
docker compose -f docker-compose.yml.example logs -f web
docker compose -f docker-compose.yml.example exec web sh
ls -la data/
```

## Coolify

Coolify deploys the single `web` container directly from `Dockerfile.web`. There
is no compose file and no persistent volume: the dataset is baked into the image
at build time and read from `DATA_DIR` (defaults to `/data`).

### 1. Create the Resource

In Coolify:

1. Create one application with the `Dockerfile` build pack
2. Point it at this repository
3. Set the Dockerfile path to `Dockerfile.web`
4. Attach your domain with target port `3000`

### 2. Configure Environment Variables

```bash
NODE_ENV=production
DATA_DIR=/data
AUTH_DISCORD_ID=...
AUTH_DISCORD_SECRET=...
NEXTAUTH_URL=https://your-domain.example
NEXTAUTH_SECRET=...
RESEND_API_KEY=...
WEBHOOK_SECRET=...
```

`DATA_DIR` is optional and defaults to `/data`.

### 3. Deploy

Deploy the application from Coolify. To publish fresh data, trigger a
rebuild/redeploy after the chb pipeline has refreshed the `data/` directory in
the build context.

### Coolify Verification

```bash
docker logs -f <container>
curl -fsS http://localhost:3000/status.json
```

For a more detailed Coolify walkthrough, see [coolify.md](./coolify.md).

## Manual Docker Builds

Build the web image:

```bash
docker build -t commonshub-brussels-web:latest -f Dockerfile.web .
```

## Quick Reference

| Task | Command |
|------|---------|
| Start local site | `docker compose -f docker-compose.yml.example up -d --build` |
| Stop local site | `docker compose -f docker-compose.yml.example down` |
| Sync data (chb pipeline, separate repo) | `chb sync` |
| Sync full history | `chb sync --history` |
| View local web logs | `docker compose -f docker-compose.yml.example logs -f web` |
| Build web image manually | `docker build -t commonshub-brussels-web:latest -f Dockerfile.web .` |

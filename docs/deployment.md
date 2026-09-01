# Deployment Guide

The website deploys as a single container that serves the Next.js site and
reads pre-generated data from `DATA_DIR` (defaults to `/data`). It never fetches
data itself — the standalone `chb` pipeline (run from its own repo) populates the
data directory.

## Files

- `Dockerfile` builds the website image
- `docker-compose.yml.example` is the local Docker setup for the `web` container
- Coolify deploys the `web` container directly from `Dockerfile` (no compose file)

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

Coolify deploys the single `web` container directly from `Dockerfile`. There is
no compose file. The dataset is read from `DATA_DIR` (defaults to `/data`),
bind-mounted from `/data/commonshub/prod` on the host.

Coolify's UI has no read-only checkbox for bind mounts, so `/data` is protected
by file permissions instead: the container runs as uid 1001, the dataset is
owned by the chb user, and nothing in the image writes there. See
[coolify.md](coolify.md#coolify-has-no-read-only-checkbox).

The website only ever writes caches, under `RUNTIME_DIR` (default
`/tmp/commonshub`). Anything it needs to record goes out over nostr, where the
chb pipeline picks it up. See
[Where the site writes](coolify.md#where-the-site-writes-runtime_dir).

### 1. Create the Resource

In Coolify:

1. Create one application with the `Dockerfile` build pack
2. Point it at this repository
3. Set the Dockerfile path to `Dockerfile`
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
EMAIL_HASH_SALT=...
```

`DATA_DIR` is optional and defaults to `/data`.

`EMAIL_HASH_SALT` turns on the membership surface. A member's id is
`sha256(lowercase(trim(email)) + EMAIL_HASH_SALT)`, minted by the chb pipeline
and used to name each member's history file; the website recomputes it from the
signed-in user's email to recognise them. It must be **byte-identical** to the
salt chb syncs with — copy it from chb's `config.env` on the pipeline host,
where it is deliberately excluded from the data sync so it never travels
automatically.

Without it, this host cannot identify anyone: `/api/members` and
`/api/members/me` both return 404 and no member data is served. That is the
intended failure mode — a wrong or missing salt should show nothing rather than
mismatch people.

Never rotate it. A new salt re-identifies the entire membership: every id
changes, every history splits in two, and nothing links the halves.

Member data is read from chb's `restricted/` tree
(`latest/generated/restricted/members/`), which exists to be served to the
member it describes once they have signed in. chb's `private/` tree is
operator-only and is never served under any condition — the code refuses any
path that lands there, so it cannot be exposed by a mistyped constant or a
future caller.

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
docker build -t commonshub-brussels-web:latest -f Dockerfile .
```

## Quick Reference

| Task | Command |
|------|---------|
| Start local site | `docker compose -f docker-compose.yml.example up -d --build` |
| Stop local site | `docker compose -f docker-compose.yml.example down` |
| Sync data (chb pipeline, separate repo) | `chb sync` |
| Sync full history | `chb sync --history` |
| View local web logs | `docker compose -f docker-compose.yml.example logs -f web` |
| Build web image manually | `docker build -t commonshub-brussels-web:latest -f Dockerfile .` |

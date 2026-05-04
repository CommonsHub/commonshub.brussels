# Deploying with Coolify

This setup uses a single Docker Compose resource in Coolify with two services:

- `web`: the Next.js website, exposed on your public domain
- `chbcli`: the private worker that holds fetch secrets and runs `chb sync`

Both services mount the same named Docker volume at `/data`.
The website gets that volume read-only. Only `chbcli` can write to it.

## Prerequisites

- A server with Coolify installed
- A domain pointing to the server
- The repository connected in Coolify
- API keys ready for the CHB worker

## Why This Layout

- The website and CLI share the same persistent `/data` volume.
- The website mounts `/data` read-only.
- Only the `chbcli` service receives external API secrets.
- The `web` service can read `/data` without having access to fetch credentials.
- A named Docker volume survives normal redeployments because the containers are recreated but the volume is kept.

## Create the Resource

1. Create a project and environment in Coolify.
2. Create one application using the `Docker Compose` build pack.
3. Point it at this repository.
4. Use [`docker-compose.coolify.yml`](/home/xdamman/Github/commonshub/commonshub.brussels/docker-compose.coolify.yml) as the compose file.

That compose file builds the website from `Dockerfile.web` and the worker from `Dockerfile.chb`.

Coolify should expose only the `web` service on your domain. Do not expose `chbcli`.
Because the website listens on container port `3000`, make sure the `web` service domain in Coolify uses target port `3000`.
That is a Coolify setting on the domain/service mapping, not a public URL you browse with `:3000`.
For example:

- Domain: `https://staging.commonshub.brussels`
- Target port: `3000`

## Environment Variables

Set the website runtime variables for the `web` service:

```bash
NODE_ENV=production
DATA_DIR=/data
AUTH_DISCORD_ID=your-discord-oauth-client-id
AUTH_DISCORD_SECRET=your-discord-oauth-client-secret
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key-here
RESEND_API_KEY=your-resend-api-key
WEBHOOK_SECRET=your-webhook-secret
```

If you do not use email or the deploy webhook, you can leave `RESEND_API_KEY` and `WEBHOOK_SECRET` unset.

Set the data-fetching secrets for the `chbcli` service only:

```bash
DATA_DIR=/data
APP_DATA_DIR=/app-data
DISCORD_BOT_TOKEN=your-discord-bot-token
LUMA_API_KEY=your-luma-api-key
STRIPE_SECRET_KEY=your-stripe-secret-key
ETHERSCAN_API_KEY=your-etherscan-api-key
MONERIUM_CLIENT_ID=your-monerium-client-id
MONERIUM_CLIENT_SECRET=your-monerium-client-secret
```

Do not define those fetch secrets on the `web` service.

## Persistent Data

The compose file declares two named volumes:

```yaml
volumes:
  commonshub-data:
    name: commonshub-data
  commonshub-app-data:
    name: commonshub-app-data
```

`commonshub-data` is mounted into both services at `/data`, so the synced dataset stays available across normal redeployments.
In the compose file, `web` mounts it read-only and `chbcli` mounts it read-write.

`commonshub-app-data` is mounted only on `chbcli` at `/app-data` (`APP_DATA_DIR`). It holds chb CLI settings and OAuth tokens that must survive redeploys; without this volume the worker would lose its credentials every time the image is rebuilt.

Important:

- Redeploying or rebuilding does not remove the volumes.
- Deleting the resource and its volumes does remove them.
- The volume names are fixed (`commonshub-data`, `commonshub-app-data`), so mount targets stay stable.

The worker image stays alive with `sleep infinity`, which lets Coolify scheduled tasks execute `chb` commands inside that container.

## First Deploy

1. Deploy the compose application.
2. Open the site. If `/data` is empty you will see the empty-data state.

## Populate the Data Directory

Use the terminal of the `chbcli` service and run:

```bash
chb sync
```

For a full backfill instead:

```bash
chb sync --history
```

After the sync finishes, refresh the website.

## Scheduled Task

Create the scheduled task on the `chbcli` service, not on the website service.

- Name: `sync-data`
- Command: `chb sync`
- Frequency: `0 * * * *`

Common alternatives:

- Every 30 minutes: `*/30 * * * *`
- Every 6 hours: `0 */6 * * *`
- Daily at midnight: `0 0 * * *`

## Why Not Two Coolify Projects

- Service-level environment variables are enough to keep fetch secrets on `chbcli` only.
- A single compose resource makes shared storage straightforward.
- Only `web` needs a domain; `chbcli` can stay internal.

## Verification

Check the website container:

```bash
docker compose -f docker-compose.coolify.yml logs -f web
```

If the app responds inside the container on `localhost:3000` but the public domain shows `no available server`, check the health and proxy path first:

```bash
curl -fsS http://localhost:3000/status.json
```

In Coolify, also verify:

- the `web` service is marked healthy
- the domain is attached to the `web` service, not `chbcli`
- the domain target port is `3000`

The `web` service health check can use `/status.json`, but that route must stay robust and return `200` even when one diagnostic sub-check degrades. The compose file therefore uses `/status.json` with a tighter probe interval so Coolify can mark the new container healthy sooner during deploys.

Check the worker container:

```bash
docker compose -f docker-compose.coolify.yml logs -f chbcli
```

Inspect the shared named volume:

```bash
docker volume inspect commonshub-data
```

## Backup

```bash
docker run --rm -v commonshub-data:/volume -v "$PWD:/backup" alpine \
  tar -czvf /backup/commonshub-backup-$(date +%Y%m%d).tar.gz -C /volume .
```

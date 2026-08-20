# Deploying with Coolify

The website deploys as a single container built from [`Dockerfile`](../Dockerfile).
There is no compose file. The pre-generated dataset is read from `DATA_DIR`
(defaults to `/data`), which in production is a **read-only bind mount** of the
host directory the chb pipeline writes to.

To publish fresh data you re-run the chb pipeline on the host; no redeploy is
needed. The separate chb pipeline owns data generation — the website only reads.

## Prerequisites

- A server with Coolify installed
- A domain pointing to the server
- The repository connected in Coolify

## Create the Resource

1. Create a project and environment in Coolify.
2. Create one application using the **Dockerfile** build pack.
3. Point it at this repository.
4. Set the Dockerfile path to `Dockerfile`.

Because the website listens on container port `3000`, set the domain's **target
port to `3000`** in Coolify. That is a Coolify setting on the domain/service
mapping, not a port you browse with `:3000`.

For example:

- Domain: `https://commonshub.brussels`
- Target port: `3000`

## Environment Variables

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

`DATA_DIR` is optional; it defaults to `/data` if unset. `RUNTIME_DIR` — the only
directory the site writes to — is optional too and defaults to `/tmp/commonshub`;
see [Where the site writes](#where-the-site-writes-runtime_dir). If you do not use
email or the deploy webhook, you can leave `RESEND_API_KEY` and `WEBHOOK_SECRET`
unset.

## Data

The dataset lives on the host and is bind-mounted into the container. In
Coolify, under **Storages → Bind mount**, configure:

| Field            | Value                    |
| ---------------- | ------------------------ |
| Source (host)    | `/data/commonshub/prod`  |
| Destination      | `/data`                  |
| Read-only        | **enabled**              |

The read-only flag is required, not cosmetic. `/data` is a bind mount, so
anything the container writes — including ownership changes — is written
straight through to the host. A container that chowns or rewrites files there
takes the dataset away from the user the chb pipeline runs as.

The container runs as `nextjs` (uid 1001), so the host files only need to be
world-readable (`755` directories, `644` files) — the normal output of the
pipeline. They do **not** need to be owned by 1001.

The image also bakes a copy of the build context's `data/` directory into
`/data` as a fallback. The bind mount shadows it whenever one is attached.

To update the data on the live site, re-run the chb pipeline on the host. The
site picks up the new files without a redeploy.

If `DATA_DIR` is empty, the website renders the empty-data state page.

## Where the site writes: `RUNTIME_DIR`

`DATA_DIR` is read-only, so everything the website writes goes under
`RUNTIME_DIR`, which defaults to `/tmp/commonshub`:

| What                        | Path                                  |
| --------------------------- | ------------------------------------- |
| Discord message cache       | `RUNTIME_DIR/messages/discord/…`      |
| Wallet address cache        | `RUNTIME_DIR/wallet-addresses.json`   |
| Resized image cache         | `RUNTIME_DIR/image-proxy/`            |
| Sync state                  | `RUNTIME_DIR/sync-state.json`         |
| Event metadata edits        | `RUNTIME_DIR/event-metadata/YYYY-MM.json` |

Every one of these degrades to memory-only if the directory cannot be written,
so an unwritable `RUNTIME_DIR` slows the site down but does not break it.

**The default is deliberately ephemeral.** `/tmp` is cleared on restart, which is
the right trade-off for caches — they simply repopulate. Set `RUNTIME_DIR` to a
writable volume if you want any of it to survive a redeploy.

The one entry that is not a cache is **event metadata**: the attendance, income
and note fields an admin fills in on the events pages. Those used to be written
back into the generated `events.json`, which the next `chb generate` overwrote
anyway. They now live in an overlay that is merged over the events when read.
If you rely on that data, either point `RUNTIME_DIR` at a volume or move the
values into the chb pipeline, which is their proper home.

Application state that must persist (proposals, identity) is kept separately,
under `PROPOSALS_DIR` / `IDENTITY_DIR` (both default to `/app/.data/…`). Those
need their own writable volume if you rely on them.

## First Deploy

1. Deploy the application.
2. Open the site. If the dataset is empty you will see the empty-data state.

## Verification

Check the container logs in Coolify, or:

```bash
docker logs -f <container>
```

If the app responds inside the container on `localhost:3000` but the public
domain shows `no available server`, check the health and proxy path first:

```bash
curl -fsS http://localhost:3000/status.json
```

In Coolify, also verify:

- the service is marked healthy
- the domain is attached to the service
- the domain target port is `3000`

The health check uses `/status.json`, which must stay robust and return `200`
even when one diagnostic sub-check degrades.

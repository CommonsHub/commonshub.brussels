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
Coolify, under **Storages → Bind mount**:

| Field         | Value                   |
| ------------- | ----------------------- |
| Source (host) | `/data/commonshub/prod` |
| Destination   | `/data`                 |

### Coolify has no read-only checkbox

`:ro` would be the obvious protection, but Coolify's UI does not expose it for
bind mounts (checked as of v4, August 2026). That is fine — the mount flag was
never what actually protected the data. Two things do:

1. **The container has no write permission.** It runs as `nextjs` (uid 1001).
   The dataset is owned by the user the chb pipeline runs as, with the ordinary
   `755` directories / `644` files the pipeline produces. uid 1001 is neither
   the owner nor in the group, so every write is refused by the kernel whether
   or not the mount says `:ro`.
2. **Nothing in the image tries to write there.** The entrypoint no longer
   chowns `/data`, and the app writes only to `RUNTIME_DIR` — enforced by
   `tests/no-server-writes.test.ts`.

The one thing that *did* defeat file permissions was the entrypoint running
`chown -R` as **root** before dropping privileges. Root ignores permission bits,
so it rewrote ownership through the bind mount and handed the dataset to uid
1001. That is gone; it now only reports what it finds:

```
[data] WARNING: /data is writable — mount it read-only (:ro) so the site cannot modify the dataset
[data] /data is readable by the runtime user
```

Seeing that warning on a Coolify deploy is expected, since the flag cannot be
set from the UI. It is a reminder, not a failure.

If you want the mount genuinely read-only anyway, do it on the host and point
Coolify at the read-only copy:

```bash
mkdir -p /data/commonshub/prod-ro
mount --bind /data/commonshub/prod /data/commonshub/prod-ro
mount -o remount,bind,ro /data/commonshub/prod-ro
```

Make it survive reboots with a systemd mount unit (`Options=bind,ro`), then set
the Coolify bind mount source to `/data/commonshub/prod-ro`.

### Ownership

If the files are already owned by `1001:1001` — the damage the old `chown -R`
did — hand them back to whoever runs the pipeline:

```bash
sudo chown -R 1000:1000 /data/commonshub/prod   # substitute the chb user
```

The site keeps working either way: the files stay world-readable, so uid 1001
can read them. The repair is for the pipeline's benefit.

The image also bakes a copy of the build context's `data/` directory into
`/data` as a fallback. The bind mount shadows it whenever one is attached.

To update the data on the live site, re-run the chb pipeline on the host. The
site picks up the new files without a redeploy.

If `DATA_DIR` is empty, the website renders the empty-data state page.

## Where the site writes: `RUNTIME_DIR`

The website reads. It does not own any data — the chb pipeline generates the
dataset, and anything the site wants to record goes out over **nostr**, where
chb picks it up. The only things it puts on disk are caches, all under
`RUNTIME_DIR` (default `/tmp/commonshub`):

| Cache                 | Path                                |
| --------------------- | ----------------------------------- |
| Discord messages      | `RUNTIME_DIR/messages/discord/…`    |
| Wallet addresses      | `RUNTIME_DIR/wallet-addresses.json` |
| Resized images        | `RUNTIME_DIR/image-proxy/`          |

Each degrades to memory-only if its directory cannot be written, so an
unwritable `RUNTIME_DIR` costs speed, never correctness. `/tmp` being cleared on
restart is the point: caches repopulate.

`tests/no-server-writes.test.ts` fails the build if any other module starts
writing to disk. If you hit it, ask whether the thing you are writing is a cache
(add it to that list, rooted at `RUNTIME_DIR`) or data (it belongs on nostr).

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

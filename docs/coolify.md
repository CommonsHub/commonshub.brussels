# Deploying with Coolify

The website deploys as a single container built from [`Dockerfile`](../Dockerfile).
There is no compose file and no persistent volume: the pre-generated dataset is
baked into the image at build time and read from `DATA_DIR` (defaults to `/data`).

To publish fresh data you rebuild/redeploy the image. The separate chb pipeline
owns data generation and populates the build context before the image is built.

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

`DATA_DIR` is optional; it defaults to `/data` if unset. If you do not use email
or the deploy webhook, you can leave `RESEND_API_KEY` and `WEBHOOK_SECRET` unset.

## Data

The dataset is copied into the image at build time (`Dockerfile` copies the
build context's `data/` directory into `DATA_DIR`). There is no mounted volume,
so the data is immutable for the life of the running container and is only as
fresh as the last deploy.

To update the data on the live site, trigger a rebuild/redeploy in Coolify after
the chb pipeline has refreshed the `data/` directory in the build context.

If `DATA_DIR` is empty, the website renders the empty-data state page.

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

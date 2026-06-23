# Stage 1: Dependencies
FROM oven/bun:1.3.11-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Stage 2: Build
FROM oven/bun:1.3.11-alpine AS builder
WORKDIR /app

# Git info passed as build args (Coolify provides these)
ARG SOURCE_COMMIT=unknown
ARG COMMIT_MSG=unknown

RUN apk add --no-cache git

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate git-info.json from build args, falling back to the local git checkout.
RUN SOURCE_COMMIT_RESOLVED="$SOURCE_COMMIT" \
 && COMMIT_MSG_RESOLVED="$COMMIT_MSG" \
 && if [ -z "$SOURCE_COMMIT_RESOLVED" ] || [ "$SOURCE_COMMIT_RESOLVED" = "unknown" ]; then SOURCE_COMMIT_RESOLVED="$(git rev-parse HEAD 2>/dev/null || echo unknown)"; fi \
 && if [ -z "$COMMIT_MSG_RESOLVED" ] || [ "$COMMIT_MSG_RESOLVED" = "unknown" ]; then COMMIT_MSG_RESOLVED="$(git log -1 --pretty=%B 2>/dev/null | tr '\n' ' ' || echo unknown)"; fi \
 && COMMIT_DATE_RESOLVED="$(git log -1 --pretty=%ci 2>/dev/null || date -Iseconds)" \
 && COMMIT_MSG_ESCAPED="$(printf '%s' "$COMMIT_MSG_RESOLVED" | sed 's/"/\\"/g')" \
 && printf '{"sha":"%s","message":"%s","date":"%s"}\n' "$SOURCE_COMMIT_RESOLVED" "$COMMIT_MSG_ESCAPED" "$COMMIT_DATE_RESOLVED" > git-info.json
RUN cat git-info.json

# Ensure data directory exists
RUN mkdir -p data

ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# Stage 3: Production runner
FROM oven/bun:1.3.11-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache bash curl libc6-compat su-exec
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Copy standalone build (includes minimal node_modules for Next.js server)
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/git-info.json ./git-info.json

# Copy settings (needed by Go CLI at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/src/settings ./src/settings

# Copy sandbox domain whitelist (used by entrypoint for DNS filtering)
COPY sandbox-domains.conf ./sandbox-domains.conf

# Create data directory and copy build-time fetched data if it exists
RUN mkdir -p /data && chown nextjs:nodejs /data
COPY --from=builder --chown=nextjs:nodejs /app/data/ /data/

# DATA_DIR must be /data (not /app/data) to use persistent volume mount
ENV DATA_DIR=/data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["bun", "server.js"]

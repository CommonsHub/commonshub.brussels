# /data API Route

The `/data` API route provides secure access to files stored in `DATA_DIR` while protecting sensitive data.

## Overview

- **Route:** `/data/[...path]`
- **File:** `src/app/data/[...path]/route.ts`
- **Purpose:** Serve data files from DATA_DIR without requiring symlinks in `public/`

## Usage

Access any file in DATA_DIR via HTTP:

```
GET /data/{path-to-file}
```

### Examples

```bash
# Get latest discord images for a channel
curl http://localhost:3000/data/latest/discord/1443322327159803945/images.json

# Get monthly transactions
curl http://localhost:3000/data/2025/01/transactions.json

# Get event data
curl http://localhost:3000/data/2025/01/events.json
```

## Security Features

### 1. Private Path Protection

Any path containing `/private/` is automatically blocked:

```bash
# ✅ Allowed
GET /data/2025/01/calendars/luma/cal-xyz.json

# ❌ Blocked (403 Forbidden)
GET /data/2025/01/calendars/luma/private/guests/evt-xyz.json
```

### 2. Path Traversal Protection

The route validates that all resolved paths stay within DATA_DIR:

```bash
# ❌ Blocked (403 Forbidden)
GET /data/../../../etc/passwd
```

### 3. Directory Listing Disabled

Directories cannot be listed:

```bash
# ❌ Blocked (403 Forbidden)
GET /data/2025/01/
```

## Supported File Types

The route automatically sets appropriate Content-Type headers:

| Extension | Content-Type |
|-----------|-------------|
| `.json` | `application/json` |
| `.jpg`, `.jpeg` | `image/jpeg` |
| `.png` | `image/png` |
| `.gif` | `image/gif` |
| `.webp` | `image/webp` |
| `.svg` | `image/svg+xml` |
| `.txt` | `text/plain` |
| `.html` | `text/html` |
| `.css` | `text/css` |
| `.js` | `application/javascript` |

Other files are served as `application/octet-stream`.

## Caching

- **Cache-Control:** `public, max-age=3600` (1 hour)
- Files are cached by browsers and CDNs
- Good for static data that doesn't change frequently

## Configuration

The route uses the `DATA_DIR` environment variable:

```bash
# .env.local
DATA_DIR=/var/data/commonshub
```

If not set, defaults to `./data` in the project root.

## Testing

Run the test suite:

```bash
# Unit tests
bun run test -- tests/data-route.test.ts

# Integration tests
bun run test -- tests/room-images-integration.test.ts
```

## Common Use Cases

### Room Photo Galleries

The `CommunityActivityGallery` component fetches images via this route:

```typescript
// Fetches: /data/latest/discord/{channelId}/images.json
useSWR(`/data/latest/discord/${channelId}/images.json`, fetcher)
```

### Financial Reports

Financial pages fetch transaction data:

```typescript
// Fetches: /data/{year}/{month}/transactions.json
fetch(`/data/${year}/${month}/transactions.json`)
```

### Calendar Events

Event pages fetch consolidated events:

```typescript
// Fetches: /data/{year}/{month}/events.json
fetch(`/data/${year}/${month}/events.json`)
```

## Deployment Notes

### Production Setup

No symlinks needed! Just set DATA_DIR in your environment:

```bash
# In your systemd service file or .env.local
Environment=DATA_DIR=/var/data/commonshub
```

### Docker Setup

Mount your data directory and set the environment variable:

```yaml
# docker-compose.yml
volumes:
  - /var/data/commonshub:/data
environment:
  - DATA_DIR=/data
```

### Verifying It Works

```bash
# Check DATA_DIR is set
echo $DATA_DIR

# Test the route
curl http://localhost:3000/data/latest/discord/1443322327159803945/images.json

# Should return JSON with images array
```

## Troubleshooting

### 404 Not Found

**Cause:** File doesn't exist in DATA_DIR

**Solution:**
```bash
# Check if file exists
ls -la $DATA_DIR/latest/discord/1443322327159803945/images.json

# If missing, trigger the external data-sync process that populates DATA_DIR
```

### 403 Forbidden

**Cause 1:** Accessing a private path
- Private paths are intentionally blocked for security

**Cause 2:** Path traversal attempt detected
- The security check blocked an invalid path

**Cause 3:** Trying to list a directory
- Directory listing is disabled by design

### Empty Response

**Cause:** DATA_DIR not set correctly

**Solution:**
```bash
# Check DATA_DIR environment variable
grep DATA_DIR .env.local

# Restart service after changing
sudo systemctl restart commonshub
```

## Migration from Symlink Approach

If you previously used symlinks (`public/data -> DATA_DIR`):

1. Remove the symlink:
   ```bash
   rm public/data
   ```

2. Ensure DATA_DIR is set in `.env.local`

3. The `/data` route will now serve files automatically

4. No code changes needed - the URL paths remain the same

## Performance Considerations

### Caching

The 1-hour cache means:
- First request reads from disk
- Subsequent requests served from browser/CDN cache
- Good for data that changes hourly/daily

### File Size

Large files are served directly without buffering:
- Efficient for images and large JSON files
- No memory issues with big datasets

### Disk I/O

Files are read synchronously from disk:
- Fast for SSD storage
- Consider using a CDN for high-traffic sites
- Data directory should be on fast storage (not NFS)

## Security Best Practices

1. **Always use DATA_DIR outside the web root**
   ```bash
   # Good
   DATA_DIR=/var/data/commonshub
   
   # Bad
   DATA_DIR=/var/www/commonshub.brussels/data
   ```

2. **Keep private data in `/private/` subdirectories**
   ```
   data/2025/01/calendars/luma/private/guests/
   ```

3. **Don't commit DATA_DIR to git**
   ```gitignore
   data/
   /data/
   ```

4. **Set appropriate file permissions**
   ```bash
   chmod 755 $DATA_DIR
   chmod 644 $DATA_DIR/**/*.json
   ```

5. **Monitor access logs for suspicious patterns**
   ```bash
   sudo journalctl -u commonshub | grep "/data/"
   ```

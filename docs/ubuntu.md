# Ubuntu Server Setup Guide

This guide walks you through setting up a fresh Ubuntu installation to host the commonshub.brussels website with Node.js, nginx, and Let's Encrypt SSL.

## Prerequisites

- Fresh Ubuntu installation (20.04 LTS or newer recommended)
- Root or sudo access
- Domain name pointing to your server's IP address
- Ports 80 and 443 open in your firewall

## 1. Initial System Setup

Update the system packages:

```bash
sudo apt update
sudo apt upgrade -y
```

Install required dependencies:

```bash
sudo apt install -y curl wget git build-essential
```

## 2. Install Node.js and Bun

Install nvm (Node Version Manager):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
```

Reload your shell configuration:

```bash
source ~/.bashrc
# Or if using zsh:
# source ~/.zshrc
```

Install Node.js LTS version:

```bash
nvm install --lts
nvm use --lts
nvm alias default node
```

Verify installation:

```bash
node --version
```

Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash

# Reload your shell configuration
source ~/.bashrc
# Or if using zsh:
# source ~/.zshrc

bun --version
```

## 3. Install and Configure nginx

Install nginx:

```bash
sudo apt install -y nginx
```

Create nginx configuration for the site:

```bash
sudo nano /etc/nginx/sites-available/commonshub.brussels
```

Add the following configuration (replace `commonshub.brussels` with your domain):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name commonshub.brussels www.commonshub.brussels;

    # Allow Let's Encrypt ACME challenges
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Create the certbot webroot directory:

```bash
sudo mkdir -p /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/commonshub.brussels /etc/nginx/sites-enabled/
```

Test nginx configuration:

```bash
sudo nginx -t
```

Restart nginx:

```bash
sudo systemctl restart nginx
```

Enable nginx to start on boot:

```bash
sudo systemctl enable nginx
```

## 4. Install Let's Encrypt SSL Certificate

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Obtain SSL certificate (replace with your domain):

```bash
sudo certbot --nginx -d commonshub.brussels -d www.commonshub.brussels
```

Follow the prompts to:
- Enter your email address
- Agree to terms of service
- Choose whether to redirect HTTP to HTTPS (recommended: yes)

Certbot will automatically:
- Obtain the certificate
- Update nginx configuration
- Set up automatic renewal

Test automatic renewal:

```bash
sudo certbot renew --dry-run
```

## 5. Deploy the Application

Clone the repository:

```bash
cd /var/www
sudo mkdir -p commonshub.brussels
sudo chown $USER:$USER commonshub.brussels
cd commonshub.brussels
git clone https://github.com/yourusername/commonshub.brussels.git .
```

Install dependencies:

```bash
bun install
```

Create environment file:

```bash
nano .env.local
```

Add required environment variables (refer to `.env.example` if available).

**Important:** Set up a custom DATA_DIR location (recommended for production):

```bash
# Create a data directory outside the application directory
mkdir -p /var/data/commonshub

# Add DATA_DIR to your .env.local
echo "DATA_DIR=/var/data/commonshub" >> .env.local
```

The application includes a `/data` API route that serves files from DATA_DIR automatically.

Data is populated into `DATA_DIR` by an external data-sync process (separate repo). The website only reads from it. Make sure `DATA_DIR` points to the directory that process writes to (defaults to `~/.chb/data`).

Build the application:

```bash
bun run build
```

## 6. Create systemd Service

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/commonshub.service
```

Add the following configuration (adjust paths and user as needed):

```ini
[Unit]
Description=CommonsHub Brussels Next.js Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/commonshub.brussels
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/home/YOUR_USERNAME/.nvm/versions/node/v20.11.0/bin/node /var/www/commonshub.brussels/node_modules/.bin/next start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=commonshub

[Install]
WantedBy=multi-user.target
```

**Important:** Update the following in the service file:
- Replace `YOUR_USERNAME` with your actual username
- Update the Node.js version path (check with `which node`)
- Adjust `User` if not using `www-data`

Set correct ownership:

```bash
sudo chown -R www-data:www-data /var/www/commonshub.brussels
```

Reload systemd:

```bash
sudo systemctl daemon-reload
```

Enable and start the service:

```bash
sudo systemctl enable commonshub
sudo systemctl start commonshub
```

Check service status:

```bash
sudo systemctl status commonshub
```

## 7. Managing the Service

Start the service:
```bash
sudo systemctl start commonshub
```

Stop the service:
```bash
sudo systemctl stop commonshub
```

Restart the service:
```bash
sudo systemctl restart commonshub
```

Check service status:
```bash
sudo systemctl status commonshub
```

Enable service to start on boot:
```bash
sudo systemctl enable commonshub
```

Disable service from starting on boot:
```bash
sudo systemctl disable commonshub
```

## 8. Viewing Logs

### Application Logs (via journalctl)

View real-time logs:
```bash
sudo journalctl -u commonshub -f
```

View logs from the last hour:
```bash
sudo journalctl -u commonshub --since "1 hour ago"
```

View logs from today:
```bash
sudo journalctl -u commonshub --since today
```

View last 100 lines:
```bash
sudo journalctl -u commonshub -n 100
```

View logs with timestamps:
```bash
sudo journalctl -u commonshub -o short-precise
```

View logs in reverse order (newest first):
```bash
sudo journalctl -u commonshub -r
```

### nginx Logs

View nginx access logs:
```bash
sudo tail -f /var/log/nginx/access.log
```

View nginx error logs:
```bash
sudo tail -f /var/log/nginx/error.log
```

Search for errors in the last 24 hours:
```bash
sudo journalctl -u nginx --since "24 hours ago" | grep error
```

### Certbot Logs

View Let's Encrypt certificate renewal logs:
```bash
sudo cat /var/log/letsencrypt/letsencrypt.log
```

## 9. Deploying Updates

To deploy updates to the application:

```bash
# Navigate to the application directory
cd /var/www/commonshub.brussels

# Pull latest changes
git pull

# Install any new dependencies
bun install

# Rebuild the application
bun run build

# Restart the service
sudo systemctl restart commonshub

# Check the status
sudo systemctl status commonshub

# Monitor logs for any errors
sudo journalctl -u commonshub -f
```

## 10. Troubleshooting

### Service won't start

Check for errors in the logs:
```bash
sudo journalctl -u commonshub -n 50 --no-pager
```

Verify Node.js path:
```bash
which node
```

Update the ExecStart path in `/etc/systemd/system/commonshub.service` if needed.

### Port already in use

Check what's using port 3000:
```bash
sudo lsof -i :3000
```

### nginx configuration errors

Test nginx configuration:
```bash
sudo nginx -t
```

View nginx error logs:
```bash
sudo tail -f /var/log/nginx/error.log
```

### SSL certificate issues

Check certificate status:
```bash
sudo certbot certificates
```

Force certificate renewal:
```bash
sudo certbot renew --force-renewal
```

**ACME Challenge Authentication Failures:**

If you get "Fetching http://yourdomain/.well-known/acme-challenge/..." timeout errors:

1. Verify firewall allows port 80:
   ```bash
   sudo ufw status
   # Should show: 80/tcp ALLOW
   ```

2. Test if your domain is accessible:
   ```bash
   curl -I http://yourdomain.com
   # Should return HTTP response, not timeout
   ```

3. Ensure nginx configuration includes the `.well-known` location block:
   ```nginx
   location ^~ /.well-known/acme-challenge/ {
       root /var/www/certbot;
       default_type "text/plain";
       allow all;
   }
   ```

4. Verify certbot directory exists and has correct permissions:
   ```bash
   ls -la /var/www/certbot
   # Should be owned by www-data
   ```

5. Test ACME challenge manually:
   ```bash
   echo "test" | sudo tee /var/www/certbot/.well-known/acme-challenge/test.txt
   curl http://yourdomain.com/.well-known/acme-challenge/test.txt
   # Should return: test
   ```

6. Check nginx error logs during certificate request:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   # Run certbot in another terminal and watch for errors
   ```

### Images or data not loading

If images don't appear in galleries or room pages:

1. **Check DATA_DIR environment variable:**
   ```bash
   # Check what DATA_DIR is set to
   grep DATA_DIR /var/www/commonshub.brussels/.env.local

   # Verify the directory exists
   ls -la /var/data/commonshub  # or your DATA_DIR path
   ```

2. **Verify data files exist:**
   ```bash
   # Check if discord images data exists
   ls -la $DATA_DIR/latest/discord/*/images.json

   # Check specific room channel (ostrom example)
   cat $DATA_DIR/latest/discord/1443322327159803945/images.json
   ```

3. **If data files are missing:** trigger a run of the external data-sync process that populates `DATA_DIR`.

4. **Test if data is accessible via the API route:**
   ```bash
   curl http://localhost:3000/data/latest/discord/1443322327159803945/images.json
   # Should return JSON with images array
   ```

5. **Check that private paths are blocked (security test):**
   ```bash
   curl http://localhost:3000/data/2025/01/calendars/luma/private/guests/test.json
   # Should return 403 Forbidden
   ```

6. **Check browser console for errors:**
   - Open Developer Tools (F12)
   - Look for 404 errors on `/data/latest/...` requests
   - Check Network tab for failed requests

7. **Restart the service after changing DATA_DIR:**
   ```bash
   sudo systemctl restart commonshub
   ```

## 11. Security Recommendations

1. **Configure firewall (ufw):**
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **Keep system updated:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

3. **Set up automatic security updates:**
   ```bash
   sudo apt install unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

4. **Disable root SSH access:**
   Edit `/etc/ssh/sshd_config` and set:
   ```
   PermitRootLogin no
   ```
   Then restart SSH:
   ```bash
   sudo systemctl restart sshd
   ```

5. **Use SSH keys instead of passwords:**
   Disable password authentication in `/etc/ssh/sshd_config`:
   ```
   PasswordAuthentication no
   ```

## Additional Resources

- [nvm Documentation](https://github.com/nvm-sh/nvm)
- [nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [systemd Documentation](https://systemd.io/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

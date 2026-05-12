#!/bin/bash
# One-time dev server setup for fleetvibe.digitalvibe.rs + apifleetvibe + portal-fleetvibe.
#
# Run as root on 46.225.99.48 AFTER DNS records point at the server:
#   ssh root@46.225.99.48
#   cd /opt/fleetvibe
#   bash scripts/setup-dev-server.sh
#
# What this does:
#   1. Ensures /opt/fleetvibe is on the dev branch
#   2. Installs /usr/local/bin/fleetvibe-deploy-dev (calls scripts/deploy-dev.sh)
#   3. Installs /usr/local/bin/fleetvibe-deploy-portal (shared dev/prod)
#   4. Grants the `deploy` user NOPASSWD sudo for both scripts
#   5. Installs Nginx vhost configs for the 3 dev subdomains and enables them
#   6. Removes the legacy docker-compose.override.yml (replaced by docker-compose.dev.yml)
#
# Manual follow-up after this script:
#   a. Create /opt/fleetvibe/.env (copy .env.dev.example, fill in real secrets)
#   b. cd /opt/fleetvibe && make dev
#   c. certbot --nginx -d apifleetvibe.digitalvibe.rs -d portal-fleetvibe.digitalvibe.rs
#      (fleetvibe.digitalvibe.rs cert may already exist - reload it if needed)

set -euo pipefail

REPO_URL="https://github.com/digitalvibers-cmd/fleet-vibe.git"
DEV_DIR="/opt/fleetvibe"
NGINX_SITES="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

# 1. Clone or update repo
if [ ! -d "$DEV_DIR/.git" ]; then
    echo "==> Cloning repo to $DEV_DIR..."
    git clone --branch dev "$REPO_URL" "$DEV_DIR"
else
    echo "==> $DEV_DIR exists, pulling latest dev..."
    cd "$DEV_DIR"
    git fetch origin dev
    git checkout dev
    git merge --ff-only origin/dev
fi
chown -R deploy:deploy "$DEV_DIR"

# 2. Remove legacy override.yml (would auto-load with stale config)
if [ -f "$DEV_DIR/docker-compose.override.yml" ]; then
    echo "==> Removing legacy docker-compose.override.yml..."
    rm -f "$DEV_DIR/docker-compose.override.yml"
fi

# 3. Install deploy scripts as system-wide commands
ln -sf "$DEV_DIR/scripts/deploy-dev.sh"    /usr/local/bin/fleetvibe-deploy-dev
ln -sf "$DEV_DIR/scripts/deploy-portal.sh" /usr/local/bin/fleetvibe-deploy-portal
chmod +x "$DEV_DIR/scripts/deploy-dev.sh" "$DEV_DIR/scripts/deploy-portal.sh"
echo "==> Installed deploy scripts."

# 4. Sudoers entry for deploy user
SUDOERS_FILE="/etc/sudoers.d/fleetvibe-dev"
cat > "$SUDOERS_FILE" <<SUDO
deploy ALL=(root) NOPASSWD: /usr/local/bin/fleetvibe-deploy-dev
deploy ALL=(root) NOPASSWD: /usr/local/bin/fleetvibe-deploy-portal
SUDO
chmod 440 "$SUDOERS_FILE"
visudo -c -f "$SUDOERS_FILE"
echo "==> Sudoers entry created at $SUDOERS_FILE"

# 5. Nginx vhost configs
cp "$DEV_DIR/docker/nginx/dev/fleetvibe-console.conf" "$NGINX_SITES/"
cp "$DEV_DIR/docker/nginx/dev/fleetvibe-api.conf"     "$NGINX_SITES/"
cp "$DEV_DIR/docker/nginx/dev/fleetvibe-portal.conf"  "$NGINX_SITES/"

ln -sf "$NGINX_SITES/fleetvibe-console.conf" "$NGINX_ENABLED/fleetvibe-console.conf"
ln -sf "$NGINX_SITES/fleetvibe-api.conf"     "$NGINX_ENABLED/fleetvibe-api.conf"
ln -sf "$NGINX_SITES/fleetvibe-portal.conf"  "$NGINX_ENABLED/fleetvibe-portal.conf"

nginx -t && systemctl reload nginx
echo "==> Nginx vhosts enabled and reloaded."

cat <<EOF

==================================================================
  Dev server setup complete. Next steps:

  1. Create /opt/fleetvibe/.env:
       cp .env.dev.example .env
       # then edit .env with real APP_KEY, DB_PASSWORD, COOKIE_SECRET,
       # MAILGUN_SECRET, GOOGLE_MAPS_API_KEY
       chmod 600 .env
       chown deploy:deploy .env

  2. Start the dev stack:
       make dev
       # or: docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

  3. Run migrations + seed ACL (first time only):
       docker compose -f docker-compose.yml -f docker-compose.dev.yml \\
         exec application php artisan migrate --force
       docker compose -f docker-compose.yml -f docker-compose.dev.yml \\
         exec application php artisan fleetbase:create-permissions
       docker compose -f docker-compose.yml -f docker-compose.dev.yml \\
         exec application php artisan fleetbase:assign-admin-roles
       docker compose -f docker-compose.yml -f docker-compose.dev.yml \\
         exec application php artisan fleetops:assign-customer-roles

  4. SSL (after DNS propagates - fleetvibe.digitalvibe.rs may already have cert):
       certbot --nginx \\
         -d fleetvibe.digitalvibe.rs \\
         -d apifleetvibe.digitalvibe.rs \\
         -d portal-fleetvibe.digitalvibe.rs
==================================================================
EOF

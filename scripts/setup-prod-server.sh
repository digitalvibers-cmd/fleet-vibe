#!/bin/bash
# One-time production server setup for flybox.rs
#
# Run as root on 46.225.99.48 AFTER DNS records have propagated:
#   ssh root@46.225.99.48
#   cd /opt/fleetvibe-prod
#   bash scripts/setup-prod-server.sh
#
# What this does:
#   1. Clones the repo to /opt/fleetvibe-prod (if not already there)
#   2. Creates /usr/local/bin/fleetvibe-deploy-prod (called by GitHub Actions)
#   3. Grants the `deploy` user NOPASSWD sudo for that script
#   4. Installs Nginx vhost configs and enables them
#
# After this script, follow these steps:
#   a. Edit docker-compose.prod.yml — replace CHANGE_ME_DB_PASSWORD and CHANGE_ME_COOKIE_SECRET
#   b. docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
#   c. docker compose -f docker-compose.yml -f docker-compose.prod.yml exec application php artisan migrate --force
#   d. certbot --nginx -d flybox.rs -d www.flybox.rs -d console.flybox.rs -d api.flybox.rs

set -euo pipefail

REPO_URL="https://github.com/digitalvibers-cmd/fleet-vibe.git"
PROD_DIR="/opt/fleetvibe-prod"
DEPLOY_SCRIPT="/usr/local/bin/fleetvibe-deploy-prod"
NGINX_SITES="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

# ─── 1. Clone or update repo ────────────────────────────────────────────────

if [ ! -d "$PROD_DIR/.git" ]; then
    echo "→ Cloning repo to $PROD_DIR..."
    git clone --branch main "$REPO_URL" "$PROD_DIR"
else
    echo "→ $PROD_DIR already exists, pulling latest main..."
    cd "$PROD_DIR"
    git fetch origin main
    git checkout main
    git merge --ff-only origin/main
fi

chown -R deploy:deploy "$PROD_DIR"

# ─── 2. Create the server-side deploy script ────────────────────────────────

cat > "$DEPLOY_SCRIPT" << 'SCRIPT'
#!/bin/bash
set -euo pipefail
cd /opt/fleetvibe-prod
git fetch origin main
git merge --ff-only origin/main
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache console customer-portal
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --no-deps console customer-portal
SCRIPT

chmod +x "$DEPLOY_SCRIPT"
echo "→ Created $DEPLOY_SCRIPT"

# ─── 3. Sudoers entry for deploy user ────────────────────────────────────────

SUDOERS_FILE="/etc/sudoers.d/fleetvibe-prod"
SUDOERS_LINE="deploy ALL=(root) NOPASSWD: $DEPLOY_SCRIPT"

echo "$SUDOERS_LINE" > "$SUDOERS_FILE"
chmod 440 "$SUDOERS_FILE"
visudo -c -f "$SUDOERS_FILE"
echo "→ Sudoers entry created at $SUDOERS_FILE"

# ─── 4. Nginx vhost configs ──────────────────────────────────────────────────

cp "$PROD_DIR/docker/nginx/prod/flybox-console.conf" "$NGINX_SITES/"
cp "$PROD_DIR/docker/nginx/prod/flybox-api.conf"     "$NGINX_SITES/"
cp "$PROD_DIR/docker/nginx/prod/flybox-portal.conf"  "$NGINX_SITES/"

ln -sf "$NGINX_SITES/flybox-console.conf" "$NGINX_ENABLED/flybox-console.conf"
ln -sf "$NGINX_SITES/flybox-api.conf"     "$NGINX_ENABLED/flybox-api.conf"
ln -sf "$NGINX_SITES/flybox-portal.conf"  "$NGINX_ENABLED/flybox-portal.conf"

nginx -t && systemctl reload nginx
echo "→ Nginx vhosts enabled and reloaded"

# ─── Done ────────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║  Server setup complete. Next steps:                             ║"
echo "║                                                                  ║"
echo "║  1. Edit /opt/fleetvibe-prod/docker-compose.prod.yml            ║"
echo "║     Replace CHANGE_ME_DB_PASSWORD (3 places)                    ║"
echo "║     Replace CHANGE_ME_COOKIE_SECRET (1 place)                   ║"
echo "║                                                                  ║"
echo "║  2. cd /opt/fleetvibe-prod                                      ║"
echo "║     docker compose -f docker-compose.yml \\                      ║"
echo "║       -f docker-compose.prod.yml up -d                          ║"
echo "║                                                                  ║"
echo "║  3. Run migrations:                                              ║"
echo "║     docker compose -f docker-compose.yml \\                      ║"
echo "║       -f docker-compose.prod.yml exec application \\             ║"
echo "║       php artisan migrate --force                                ║"
echo "║                                                                  ║"
echo "║  4. SSL (after DNS propagates):                                  ║"
echo "║     certbot --nginx \\                                            ║"
echo "║       -d flybox.rs -d www.flybox.rs \\                           ║"
echo "║       -d console.flybox.rs -d api.flybox.rs                     ║"
echo "╚══════════════════════════════════════════════════════════════════╝"

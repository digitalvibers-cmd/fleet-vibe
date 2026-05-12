#!/bin/bash
# One-time production server setup for flybox.rs.
#
# Run as root on 46.225.99.48 AFTER DNS records point at the server:
#   ssh root@46.225.99.48
#   cd /opt/fleetvibe-prod
#   bash scripts/setup-prod-server.sh
#
# What this does:
#   1. Ensures /opt/fleetvibe-prod is on the main branch
#   2. Installs /usr/local/bin/fleetvibe-deploy-prod (calls scripts/deploy-prod.sh)
#   3. Installs /usr/local/bin/fleetvibe-deploy-portal (shared dev/prod)
#   4. Grants the `deploy` user NOPASSWD sudo for both scripts
#   5. Installs Nginx vhost configs for flybox.rs and enables them
#
# Manual follow-up after this script:
#   a. Create /opt/fleetvibe-prod/.env (copy .env.prod.example, fill in real secrets)
#   b. cd /opt/fleetvibe-prod && make prod  (or run the docker compose command directly)
#   c. certbot --nginx -d flybox.rs -d www.flybox.rs -d console.flybox.rs -d api.flybox.rs

set -euo pipefail

REPO_URL="https://github.com/digitalvibers-cmd/fleet-vibe.git"
PROD_DIR="/opt/fleetvibe-prod"
NGINX_SITES="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

# 1. Clone or update repo
if [ ! -d "$PROD_DIR/.git" ]; then
    echo "==> Cloning repo to $PROD_DIR..."
    git clone --branch main "$REPO_URL" "$PROD_DIR"
else
    echo "==> $PROD_DIR exists, pulling latest main..."
    cd "$PROD_DIR"
    git fetch origin main
    git checkout main
    git merge --ff-only origin/main
fi
chown -R deploy:deploy "$PROD_DIR"

# 2. Install deploy scripts as system-wide commands (sourced from repo for easy update)
ln -sf "$PROD_DIR/scripts/deploy-prod.sh"   /usr/local/bin/fleetvibe-deploy-prod
ln -sf "$PROD_DIR/scripts/deploy-portal.sh" /usr/local/bin/fleetvibe-deploy-portal
chmod +x "$PROD_DIR/scripts/deploy-prod.sh" "$PROD_DIR/scripts/deploy-portal.sh"
echo "==> Installed deploy scripts."

# 3. Sudoers entry for deploy user
SUDOERS_FILE="/etc/sudoers.d/fleetvibe-prod"
cat > "$SUDOERS_FILE" <<SUDO
deploy ALL=(root) NOPASSWD: /usr/local/bin/fleetvibe-deploy-prod
deploy ALL=(root) NOPASSWD: /usr/local/bin/fleetvibe-deploy-portal
SUDO
chmod 440 "$SUDOERS_FILE"
visudo -c -f "$SUDOERS_FILE"
echo "==> Sudoers entry created at $SUDOERS_FILE"

# 4. Nginx vhost configs
cp "$PROD_DIR/docker/nginx/prod/flybox-console.conf" "$NGINX_SITES/"
cp "$PROD_DIR/docker/nginx/prod/flybox-api.conf"     "$NGINX_SITES/"
cp "$PROD_DIR/docker/nginx/prod/flybox-portal.conf"  "$NGINX_SITES/"

ln -sf "$NGINX_SITES/flybox-console.conf" "$NGINX_ENABLED/flybox-console.conf"
ln -sf "$NGINX_SITES/flybox-api.conf"     "$NGINX_ENABLED/flybox-api.conf"
ln -sf "$NGINX_SITES/flybox-portal.conf"  "$NGINX_ENABLED/flybox-portal.conf"

nginx -t && systemctl reload nginx
echo "==> Nginx vhosts enabled and reloaded."

cat <<EOF

==================================================================
  Prod server setup complete. Next steps:

  1. Create /opt/fleetvibe-prod/.env:
       cp .env.prod.example .env
       # then edit .env with real APP_KEY, DB_PASSWORD, COOKIE_SECRET,
       # MAILGUN_SECRET, GOOGLE_MAPS_API_KEY
       chmod 600 .env
       chown deploy:deploy .env

  2. Start the prod stack:
       make prod
       # or: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

  3. Run migrations + seed ACL (first time only):
       docker compose -f docker-compose.yml -f docker-compose.prod.yml \\
         exec application php artisan migrate --force
       docker compose -f docker-compose.yml -f docker-compose.prod.yml \\
         exec application php artisan fleetbase:create-permissions
       docker compose -f docker-compose.yml -f docker-compose.prod.yml \\
         exec application php artisan fleetbase:assign-admin-roles
       docker compose -f docker-compose.yml -f docker-compose.prod.yml \\
         exec application php artisan fleetops:assign-customer-roles

  4. SSL (after DNS propagates):
       certbot --nginx \\
         -d flybox.rs -d www.flybox.rs \\
         -d console.flybox.rs -d api.flybox.rs
==================================================================
EOF

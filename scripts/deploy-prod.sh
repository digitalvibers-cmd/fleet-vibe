#!/usr/bin/env bash
# deploy-prod.sh - Pulls main branch and rebuilds the prod stack.
# Installed on the Hetzner server as /usr/local/bin/fleetvibe-deploy-prod.
#
# Triggered from .github/workflows/deploy-prod.yml via sudo NOPASSWD.

set -euo pipefail

REPO_DIR="/opt/fleetvibe-prod"
OVERLAY="docker-compose.prod.yml"

cd "$REPO_DIR"

echo "==> Fetching latest code from origin/main..."
git fetch origin

echo "==> Fast-forward merging origin/main..."
git merge --ff-only origin/main

echo "==> Updating submodules..."
git submodule update --init --recursive

echo "==> Rebuilding console, application, httpd..."
docker compose -f docker-compose.yml -f "$OVERLAY" build --no-cache console application httpd

echo "==> Restarting changed services..."
# httpd is recreated alongside application so nginx picks up the new
# application container IP. See "httpd (nginx) keširani upstream IP"
# in CLAUDE.md for the underlying bug this prevents.
docker compose -f docker-compose.yml -f "$OVERLAY" up -d --no-deps --force-recreate console application queue scheduler httpd

echo "==> Running database migrations..."
# Migrations shipped with the code (e.g. wms_integration_tokens) have to exist
# before the new code serves traffic; `migrate --force` is idempotent. The
# application container was just recreated, so retry briefly while it comes up
# and fail the deploy if migrations cannot be applied.
for attempt in 1 2 3 4 5 6; do
  if docker compose -f docker-compose.yml -f "$OVERLAY" exec -T application php artisan migrate --force; then
    break
  fi
  if [ "$attempt" -eq 6 ]; then
    echo "!! Database migrations failed after $attempt attempts; prod deploy aborted." >&2
    exit 1
  fi
  echo "   migrate attempt $attempt failed, retrying in 5s..."
  sleep 5
done

echo "==> Prod stack deployed."

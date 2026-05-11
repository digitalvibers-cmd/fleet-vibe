#!/usr/bin/env bash
# local-setup.sh - First-time local dev setup.
#
# Idempotent: safe to re-run.
# Run from the project root: ./scripts/local-setup.sh

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "==> Initializing git submodules..."
git submodule update --init --recursive

ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
    echo "==> No .env found, creating from .env.local.example..."
    cp .env.local.example "$ENV_FILE"
    chmod 600 "$ENV_FILE"

    if ! command -v openssl >/dev/null 2>&1; then
        echo "openssl not found - install it and retry, or edit .env manually." >&2
        exit 1
    fi
    APP_KEY="base64:$(openssl rand -base64 32 | tr -d '\n')"
    COOKIE_SECRET="$(openssl rand -hex 32)"

    sed -i.bak "s|^APP_KEY=.*|APP_KEY=$APP_KEY|" "$ENV_FILE"
    sed -i.bak "s|^COOKIE_SECRET=.*|COOKIE_SECRET=$COOKIE_SECRET|" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"

    echo "==> Generated APP_KEY and COOKIE_SECRET in .env"
    echo "    MAILGUN_SECRET defaults to placeholder (mail is sent to log locally, so this is unused)."
    echo "    GOOGLE_MAPS_API_KEY defaults to the prod key (per project policy)."
else
    echo "==> .env already exists, leaving it alone."
fi

echo "==> Building containers..."
docker compose -f docker-compose.yml -f docker-compose.local.yml build

echo "==> Starting stack..."
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d

echo "==> Waiting for database to be ready..."
for _ in $(seq 1 30); do
    if docker compose -f docker-compose.yml -f docker-compose.local.yml exec -T database mysqladmin --silent ping -h 127.0.0.1 >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

echo "==> Running migrations and deploy script in application container..."
docker compose -f docker-compose.yml -f docker-compose.local.yml exec -T application bash -c "./deploy.sh"

cat <<EOF

==================================================================
  Local stack is up.

  Console: http://localhost:4200
  API:     http://localhost:8000
  Portal:  http://localhost:3000

  Useful commands:
    make local-logs    Tail logs
    make local-shell   Bash in the application container
    make local-down    Stop everything

  Mail is sent to laravel.log (storage/logs/laravel.log) so test
  emails never reach real customers.
==================================================================
EOF

#!/usr/bin/env bash
# deploy-portal.sh - Builds and restarts the customer-portal container.
# Installed on the Hetzner server as /usr/local/bin/fleetvibe-deploy-portal.
#
# Usage:
#   sudo -n /usr/local/bin/fleetvibe-deploy-portal dev
#   sudo -n /usr/local/bin/fleetvibe-deploy-portal prod

set -euo pipefail

ENV_NAME="${1:-dev}"

case "$ENV_NAME" in
  dev)
    REPO_DIR="/opt/fleetvibe"
    BRANCH="dev"
    OVERLAY="docker-compose.dev.yml"
    ;;
  prod)
    REPO_DIR="/opt/fleetvibe-prod"
    BRANCH="main"
    OVERLAY="docker-compose.prod.yml"
    ;;
  *)
    echo "Unknown environment: $ENV_NAME (expected: dev | prod)" >&2
    exit 1
    ;;
esac

cd "$REPO_DIR"

echo "==> [$ENV_NAME] Fetching latest code from origin/$BRANCH..."
git fetch origin

echo "==> [$ENV_NAME] Fast-forward merging origin/$BRANCH..."
git merge --ff-only "origin/$BRANCH"

echo "==> [$ENV_NAME] Building customer-portal..."
docker compose -f docker-compose.yml -f "$OVERLAY" build --no-cache customer-portal

echo "==> [$ENV_NAME] Restarting customer-portal..."
docker compose -f docker-compose.yml -f "$OVERLAY" up -d customer-portal

echo "==> [$ENV_NAME] Portal deployed."

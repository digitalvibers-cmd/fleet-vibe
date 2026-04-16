#!/usr/bin/env bash
# deploy-portal.sh — Builds and restarts the customer-portal container.
# Intended to be installed on the Hetzner server at:
#   /usr/local/bin/fleetvibe-deploy-portal
#
# Usage (from CI or manually):
#   sudo -n /usr/local/bin/fleetvibe-deploy-portal

set -euo pipefail

REPO_DIR="/opt/fleetvibe"

cd "$REPO_DIR"

echo "==> Fetching latest code..."
git fetch origin

echo "==> Fast-forward merging dev..."
git merge --ff-only origin/dev

echo "==> Building customer-portal container..."
docker compose build --no-cache customer-portal

echo "==> Restarting customer-portal..."
docker compose up -d customer-portal

echo "==> Done. Portal deployed successfully."

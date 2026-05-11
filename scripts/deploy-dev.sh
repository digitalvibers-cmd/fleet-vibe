#!/usr/bin/env bash
# deploy-dev.sh - Pulls dev branch and rebuilds the dev stack.
# Installed on the Hetzner server as /usr/local/bin/fleetvibe-deploy-dev.
#
# Triggered from .github/workflows/deploy-dev.yml via sudo NOPASSWD.

set -euo pipefail

REPO_DIR="/opt/fleetvibe"
OVERLAY="docker-compose.dev.yml"

cd "$REPO_DIR"

echo "==> Fetching latest code from origin/dev..."
git fetch origin

echo "==> Fast-forward merging origin/dev..."
git merge --ff-only origin/dev

echo "==> Updating submodules..."
git submodule update --init --recursive

echo "==> Rebuilding console and application..."
docker compose -f docker-compose.yml -f "$OVERLAY" build --no-cache console application

echo "==> Restarting changed services..."
docker compose -f docker-compose.yml -f "$OVERLAY" up -d --no-deps console application queue scheduler

echo "==> Dev stack deployed."

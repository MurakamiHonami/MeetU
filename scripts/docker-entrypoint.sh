#!/usr/bin/env bash
# Seed node_modules into named volumes and start the given command.
set -euo pipefail

cd /app

LOCKHASH="$(sha256sum package-lock.json | awk '{print $1}')"
STAMP="node_modules/.docker-lockhash"
IMAGE_HASH_FILE="/opt/npm/lockhash"

if [[ ! -f backend/.dev.vars ]]; then
  echo "Creating backend/.dev.vars from example"
  cp backend/.dev.vars.example backend/.dev.vars
fi

seed_from_image() {
  echo "Seeding node_modules from image layer..."
  mkdir -p node_modules backend/node_modules frontend/node_modules
  if [[ -d /opt/npm/root ]]; then
    cp -a /opt/npm/root/. node_modules/
  fi
  if [[ -d /opt/npm/backend ]]; then
    cp -a /opt/npm/backend/. backend/node_modules/
  fi
  if [[ -d /opt/npm/frontend ]]; then
    cp -a /opt/npm/frontend/. frontend/node_modules/
  fi
  echo "$LOCKHASH" > "$STAMP"
}

if [[ ! -f "$STAMP" || "$(cat "$STAMP")" != "$LOCKHASH" ]]; then
  if [[ -f "$IMAGE_HASH_FILE" && "$(cat "$IMAGE_HASH_FILE")" == "$LOCKHASH" && -d /opt/npm/root ]]; then
    seed_from_image
  else
    echo "Installing npm dependencies (package-lock.json changed or image cache missed)..."
    npm ci
    echo "$LOCKHASH" > "$STAMP"
  fi
fi

exec "$@"

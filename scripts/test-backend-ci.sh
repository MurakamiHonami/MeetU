#!/usr/bin/env bash
# Run backend tests without .dev.vars so results match GitHub Actions.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
dev_vars="$root/backend/.dev.vars"
backup=""

cleanup() {
  if [[ -n "$backup" && -f "$backup" ]]; then
    mv "$backup" "$dev_vars"
  fi
}
trap cleanup EXIT

if [[ -f "$dev_vars" ]]; then
  backup="$(mktemp)"
  mv "$dev_vars" "$backup"
fi

cd "$root"
npm run test:coverage -w meetu-backend
npm run test:integration -w meetu-backend

#!/usr/bin/env bash
# Integration tests against live staging API (run before production deploy).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [[ -f "$root/domains.env" ]]; then
  # shellcheck disable=SC1091
  source "$root/domains.env"
fi

export STAGING_API="${STAGING_API:-https://api-meetu-staging.ruxel.net}"

echo "Running staging integration tests against ${STAGING_API} ..."
npm run test:staging -w meetu-backend

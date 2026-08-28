#!/usr/bin/env bash
# Create Cloudflare Workers Observability destinations for Datadog OTLP export.
# Requires: DATADOG_API_KEY, CLOUDFLARE_API_TOKEN (Workers Observability Write)
#
# Usage:
#   DATADOG_API_KEY=... CLOUDFLARE_API_TOKEN=... bash scripts/setup-datadog-observability.sh
#   DATADOG_SITE=datadoghq.eu  # optional, default datadoghq.com (US1)
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
account_id="${CLOUDFLARE_ACCOUNT_ID:-e3800962ed5e416e565f49c823868cf3}"
site="${DATADOG_SITE:-datadoghq.com}"
token="${CLOUDFLARE_API_TOKEN:-}"

if [[ -z "${DATADOG_API_KEY:-}" ]]; then
  echo "error: set DATADOG_API_KEY (Datadog → Organization Settings → API Keys)" >&2
  exit 1
fi
if [[ -z "$token" ]]; then
  echo "error: set CLOUDFLARE_API_TOKEN (needs Workers Observability Write)" >&2
  exit 1
fi

base="https://cloudflare.integrations.otlp.${site}"
api="https://api.cloudflare.com/client/v4/accounts/${account_id}/workers/observability/destinations"

create_destination() {
  local name="$1"
  local dataset="$2"
  local url="$3"

  existing="$(curl -sS -H "Authorization: Bearer ${token}" "${api}" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for d in data.get('result', []):
    if d.get('name') == '${name}':
        print('yes')
        break
" 2>/dev/null || true)"

  if [[ "$existing" == "yes" ]]; then
    echo "skip ${name} (already exists)"
    return 0
  fi

  echo "create ${name} → ${url}"
  curl -sS -X POST "${api}" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d "$(python3 - <<PY
import json
print(json.dumps({
  "name": "${name}",
  "enabled": True,
  "configuration": {
    "type": "logpush",
    "url": "${url}",
    "logpushDataset": "${dataset}",
    "headers": {"dd-api-key": "${DATADOG_API_KEY}"},
  },
}))
PY
)" | python3 -c "
import json, sys
r = json.load(sys.stdin)
if not r.get('success'):
    print(json.dumps(r, indent=2), file=sys.stderr)
    sys.exit(1)
print('  ok:', r['result']['name'])
"
}

echo "Account: ${account_id}"
echo "Datadog site: ${site}"
echo ""

create_destination "datadog-traces" "opentelemetry-traces" "${base}/v1/traces"
create_destination "datadog-logs" "opentelemetry-logs" "${base}/v1/logs"

echo ""
echo "Done. Redeploy Workers (just deploy-staging) then check:"
echo "  Cloudflare → Workers Observability → Destinations"
echo "  Datadog → APM Traces / Log Explorer"
echo "See docs/datadog-observability.md"

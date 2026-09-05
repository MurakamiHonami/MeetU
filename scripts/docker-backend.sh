#!/usr/bin/env bash
# Apply local D1 migrations then start wrangler (must listen on 0.0.0.0 inside Docker).
set -euo pipefail
cd /app/backend
npm run db:migrate:d1-local
exec npx wrangler dev --ip 0.0.0.0 --port 8787

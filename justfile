# MeetU Command Runner (just)
#
# Deploy shortcuts:
#   just deploy-staging      → staging API + Web
#   just deploy-production   → production API + Web
#   just release-staging     → check + staging 一式 (+ migrate)
#   just release-production  → check + production 一式 (+ migrate, seed なし)

set export
export CLOUDFLARE_ACCOUNT_ID := "e3800962ed5e416e565f49c823868cf3"

default:
    @just --list

# --------------------------------------------------
# Local development
# --------------------------------------------------

# Start Cloudflare Workers local dev server (localhost:8787)
dev-backend:
    cd backend && npm run dev

# Start Vite frontend dev server (localhost:5173)
dev-frontend:
    cd frontend && npm run dev

# Run backend Vitest tests
test:
    cd backend && npm run test

# Run TypeScript type checks
typecheck:
    cd backend && npm run typecheck
    cd frontend && npm run build

# db:verify + typecheck + tests
check:
    cd backend && npm run db:verify
    just typecheck
    just test

# Scan repository for leaked secrets
lint-secrets:
    npm run lint:secrets

# --------------------------------------------------
# Database (Drizzle)
# --------------------------------------------------

# Generate SQL migration from schema.ts changes
db-generate:
    cd backend && npm run db:generate

# Apply migrations to local SQLite
db-migrate-local:
    cd backend && npm run db:migrate

# Verify schema.ts matches drizzle/ migrations (CI と同じ)
db-verify:
    cd backend && npm run db:verify

# Apply migrations to staging D1
d1-migrate-staging:
    cd backend && npm run db:migrate:staging

# Apply migrations to production D1
d1-migrate-production:
    cd backend && npm run db:migrate:production

# Wipe staging D1 and re-apply migrations (data loss)
d1-reset-staging:
    cd backend && npx wrangler d1 execute meetu-db-staging --remote --env staging --file=scripts/reset-remote.sql && npm run db:migrate:staging

# Insert demo users/cards via local API (dev-backend 起動中)
db-seed:
    cd backend && npm run db:seed

# Insert demo users/cards into staging API
d1-seed-staging:
    cd backend && npm run db:seed:staging

# --------------------------------------------------
# Cloudflare login
# --------------------------------------------------

login:
    npx wrangler login

# --------------------------------------------------
# Deploy — Staging
#   Web: https://meetu.staging.ruxel.net
#   API: https://api-meetu-staging.ruxel.net
# --------------------------------------------------

# Deploy staging API only
deploy-staging-backend: check
    cd backend && npx wrangler deploy --env staging

# Deploy staging Web only
deploy-staging-frontend:
    cd frontend && npm run deploy:staging

# Deploy staging API + Web (日常のデプロイ)
deploy-staging: deploy-staging-backend deploy-staging-frontend

# check + API + migrate + Web
release-staging: deploy-staging-backend d1-migrate-staging deploy-staging-frontend

# release-staging + demo seed
staging-setup: release-staging d1-seed-staging

# --------------------------------------------------
# Deploy — Production
#   Web: https://meetu.ruxel.net
#   API: https://api.meetu.ruxel.net
# --------------------------------------------------

# Deploy production API only
deploy-production-backend: check
    cd backend && npx wrangler deploy --env production

# Deploy production Web only
deploy-production-frontend:
    cd frontend && npm run deploy:production

# Deploy production API + Web (seed なし)
deploy-production: deploy-production-backend deploy-production-frontend

# check + API + migrate + Web (seed なし)
release-production: deploy-production-backend d1-migrate-production deploy-production-frontend

# --------------------------------------------------
# Aliases
# --------------------------------------------------

# デフォルトは staging
deploy: deploy-staging
deploy-backend: deploy-staging-backend
deploy-frontend: deploy-staging-frontend
production-setup: release-production

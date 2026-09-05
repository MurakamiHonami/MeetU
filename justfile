# MeetU Command Runner (just)
#
# Deploy shortcuts:
#   just deploy-staging      → staging API + Web
#   just deploy-production   → production API + Web
#   just release-staging     → staging 一式 (+ migrate)
#   just release-production  → production 一式 (+ migrate, seed なし)

set export
export CLOUDFLARE_ACCOUNT_ID := "e3800962ed5e416e565f49c823868cf3"

default:
    @just --list

# --------------------------------------------------
# Local development
# --------------------------------------------------

# Install all workspace dependencies (single npm ci)
setup:
    npm ci

# Start backend + frontend dev servers together
dev:
    npm run dev

# Start Cloudflare Workers local dev server (localhost:8787)
dev-backend:
    npm run dev:backend

# Start Next.js frontend dev server (localhost:5173)
dev-frontend:
    npm run dev:frontend

# Docker: backend (8787) + frontend (5173). Node/just 不要。
docker-up:
    docker compose up --build

# Docker: バックグラウンド起動
docker-up-d:
    docker compose up --build -d

docker-down:
    docker compose down

docker-logs:
    docker compose logs -f

# デモデータ投入（docker-up 後。seed-*@meetu.local / seedpass123）
docker-seed:
    docker compose exec backend npm run db:seed -w meetu-backend

# コンテナ停止 + D1/node_modules ボリューム削除
docker-reset:
    docker compose down -v

# Run all tests (backend + frontend)
test:
    npm run test

# Backend tests without .dev.vars (same as GitHub Actions)
test-backend-ci:
    bash scripts/test-backend-ci.sh

# Live staging API integration tests (network required)
test-staging-integration:
    bash scripts/test-staging-integration.sh

# Run TypeScript type checks (no production build)
typecheck:
    npm run typecheck


# Lean 4 proofs for unbounded N:N cycle cover (not part of just ci)
lean-build:
    cd lean && lake build

# Write theorem witnesses to lean/fixtures/cycle-cover.json for vitest
lean-export-tests: lean-build
    mkdir -p lean/fixtures
    cd lean && lake exe export_tests fixtures/cycle-cover.json

# db:verify + typecheck + tests
check:
    cd backend && npm run db:verify
    just typecheck
    just test-backend-ci
    npm run test -w meetu-web

# CI / pre-push と同じ検証（GitHub Actions は先に just setup 済み）
ci: format-check lint lint-secrets check-conventions check

# package.json と lockfile の同期（CI の npm ci が最初に見るもの）
lockfile-check:
    npm ci --dry-run --ignore-scripts

# pre-push 用。lockfile ずれを先に落としてから just ci。
ci-push: lockfile-check ci

# AGENTS.md のルールを機械的にチェック（DomainError 未使用 / zValidator 未使用）
# 見つかったら AGENTS.md を読んで直す。lint/typecheck では検出できない規約違反。
check-conventions:
    #!/usr/bin/env bash
    set -euo pipefail
    fail=0
    bare_errors=$(grep -rn "throw new Error(" backend/src --include="*.ts" | grep -v "domain/shared/DomainError.ts" || true)
    if [ -n "$bare_errors" ]; then
      echo "❌ 素の 'throw new Error(...)' が見つかりました。NotFoundError/ForbiddenError/ConflictError/ValidationError を使ってください（AGENTS.md 参照）:"
      echo "$bare_errors"
      fail=1
    fi
    manual_json=$(grep -rln "c.req.json()" backend/src/interfaces/routes --include="*.ts" || true)
    if [ -n "$manual_json" ]; then
      echo "❌ ルートで手動 c.req.json() が見つかりました。zValidator(\"json\", schema) を使ってください（AGENTS.md 参照）:"
      echo "$manual_json"
      fail=1
    fi
    if [ "$fail" -eq 1 ]; then
      exit 1
    fi
    echo "✅ AGENTS.md の規約チェック OK"

# Oxlint (backend + frontend)
lint:
    npm run lint

lint-fix:
    npm run lint:fix

format:
    npm run format

format-check:
    npm run format:check

# Scan repository for leaked secrets
lint-secrets:
    npm run lint:secrets

# --------------------------------------------------
# Database (Drizzle)
# --------------------------------------------------

# Generate SQL migration from schema.ts changes
db-generate:
    cd backend && npm run db:generate

# Apply migrations to local SQLite (.data/meetu.sqlite; drizzle-kit)
db-migrate-local:
    cd backend && npm run db:migrate

# Apply migrations to wrangler local D1 (just dev / Docker の API が使う DB)
db-migrate-d1-local:
    cd backend && npm run db:migrate:d1-local

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
deploy-staging-backend:
    cd backend && npx wrangler deploy --env staging

# Deploy staging Web only
deploy-staging-frontend:
    cd frontend && npm run deploy:staging

# Deploy staging API + Web (日常のデプロイ)
deploy-staging: deploy-staging-backend deploy-staging-frontend

# API + migrate + Web
release-staging: deploy-staging-backend d1-migrate-staging deploy-staging-frontend

# release-staging + demo seed
staging-setup: release-staging d1-seed-staging

# --------------------------------------------------
# Deploy — Production
#   Web: https://meetu.ruxel.net
#   API: https://api.meetu.ruxel.net
# --------------------------------------------------

# Deploy production API only
deploy-production-backend:
    cd backend && npx wrangler deploy --env production

# Deploy production Web only
deploy-production-frontend:
    cd frontend && npm run deploy:production

# Deploy production API + Web (seed なし)
deploy-production: deploy-production-backend deploy-production-frontend

# API + migrate + Web (seed なし)
release-production: deploy-production-backend d1-migrate-production deploy-production-frontend

# --------------------------------------------------
# Aliases
# --------------------------------------------------

# デフォルトは staging
deploy: deploy-staging
deploy-backend: deploy-staging-backend
deploy-frontend: deploy-staging-frontend
production-setup: release-production

#!/usr/bin/env node
/**
 * Attach Workers custom domains via the script domains API.
 *
 * Wrangler deploy with `routes` + `custom_domain` also calls GET /zones/{id}/workers/routes
 * (conflict check). Zone-scoped API tokens often fail there with auth error 10000 even when
 * worker upload succeeds. This script uses only account-scoped script domain endpoints.
 *
 * Usage: node scripts/ensure-worker-domains.mjs --env staging|production
 */

const ZONE_ID = 'bdbf7e30ed6987f1a240291681d33ca7';

const DOMAIN_TARGETS = {
  staging: [
    { script: 'meetu-backend-staging', hostname: 'api-meetu-staging.ruxel.net' },
    { script: 'meetu-web-staging', hostname: 'meetu.staging.ruxel.net' },
  ],
  production: [
    { script: 'meetu-backend', hostname: 'api.meetu.ruxel.net' },
    { script: 'meetu-web', hostname: 'meetu.ruxel.net' },
  ],
};

function parseEnvArg() {
  const idx = process.argv.indexOf('--env');
  const env = idx >= 0 ? process.argv[idx + 1] : undefined;
  if (env !== 'staging' && env !== 'production') {
    console.error('Usage: node scripts/ensure-worker-domains.mjs --env staging|production');
    process.exit(1);
  }
  return env;
}

async function ensureDomain({ accountId, token, script, hostname }) {
  const url =
    `https://api.cloudflare.com/client/v4/accounts/${accountId}` +
    `/workers/scripts/${encodeURIComponent(script)}/domains/records`;

  const body = {
    override_scope: true,
    override_existing_origin: true,
    override_existing_dns_record: true,
    origins: [{ hostname, zone_id: ZONE_ID }],
  };

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!json.success) {
    const detail = JSON.stringify(json.errors ?? json, null, 2);
    throw new Error(`Failed to attach ${hostname} to ${script}: ${detail}`);
  }

  console.log(`Attached ${hostname} → ${script}`);
}

async function main() {
  const env = parseEnvArg();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !token) {
    console.error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be set');
    process.exit(1);
  }

  for (const target of DOMAIN_TARGETS[env]) {
    await ensureDomain({ accountId, token, ...target });
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});

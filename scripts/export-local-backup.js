// Local production-data backup for VERITY Inventory (fresh-client reset safety).
//
// Uses the Firebase CLI's own login session (~/.config/configstore/firebase-tools.json)
// to obtain a short-lived OAuth access token, then runs a Firestore runQuery per
// collection and writes every document to a local, git-ignored folder:
//
//   node scripts/export-local-backup.js [output-label]
//   -> .firestore-backup/<label>/<collection>.json + manifest.json (counts)
//
// NO secrets are read from the repo: the OAuth client id/secret are taken from
// the locally installed firebase-tools (the same values the CLI itself uses).
// Tokens and document contents are never printed - only per-collection counts.

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const PROJECT_ID = 'verity-inventory';
const COLLECTIONS = [
  'verity_products',
  'verity_categories',
  'verity_sales',
  'verity_purchases',
  'verity_expenses',
  'verity_stockMovements',
  'verity_users',
  'verity_auditEvents',
  'verity_idempotency',
  'verity_meta',
];

const repoRoot = path.resolve(__dirname, '..');
const configstorePath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');

function request(url, { method = 'GET', headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function readFirebaseToolsClient() {
  const apiPath = path.join(
    process.env.APPDATA || '',
    'npm', 'node_modules', 'firebase-tools', 'lib', 'api.js',
  );
  const src = fs.readFileSync(apiPath, 'utf8');
  const id = src.match(/FIREBASE_CLIENT_ID",\s*"([^"]+)"/);
  const secret = src.match(/FIREBASE_CLIENT_SECRET",\s*"([^"]+)"/);
  if (!id || !secret) throw new Error('Could not read OAuth client settings from firebase-tools.');
  return { clientId: id[1], clientSecret: secret[1] };
}

async function refreshAccessToken(tokens) {
  const { clientId, clientSecret } = readFirebaseToolsClient();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
  }).toString();
  const res = await request('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (res.status !== 200) throw new Error(`Token refresh failed (HTTP ${res.status}). Run "firebase login" and retry.`);
  return JSON.parse(res.text).access_token;
}

async function getAccessToken() {
  const cfg = JSON.parse(fs.readFileSync(configstorePath, 'utf8'));
  const tokens = cfg.tokens || {};
  if (!tokens.refresh_token) throw new Error('No Firebase CLI refresh token found. Run "firebase login" first.');
  const now = Date.now();
  if (tokens.access_token && Number(tokens.expires_at) > now + 120000) {
    return tokens.access_token;
  }
  const accessToken = await refreshAccessToken(tokens);
  tokens.access_token = accessToken;
  tokens.expires_at = now + (Number(tokens.expires_in || 3599) * 1000);
  fs.writeFileSync(configstorePath, JSON.stringify(cfg, null, 2));
  return accessToken;
}

function parseStream(text) {
  try {
    return JSON.parse(text);
  } catch {
    // Server-streaming endpoints may deliver several JSON arrays back to back.
    return JSON.parse(`[${text.replace(/]\s*\[/g, ',')}]`);
  }
}

async function runQuery(token, collectionId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const res = await request(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }] } }),
  });
  if (res.status !== 200) {
    throw new Error(`runQuery(${collectionId}) failed: HTTP ${res.status} ${res.text.slice(0, 200)}`);
  }
  const rows = parseStream(res.text);
  const docs = [];
  let readTime = null;
  for (const row of rows) {
    if (row.document) {
      docs.push({
        __name__: row.document.name.split('/').pop(),
        ...row.document.fields,
      });
    }
    if (!readTime && row.readTime) readTime = row.readTime;
  }
  return { docs, readTime };
}

async function main() {
  const label = process.argv[2] || `backup-${new Date().toISOString().slice(0, 10)}`;
  const outDir = path.join(repoRoot, '.firestore-backup', label);
  fs.mkdirSync(outDir, { recursive: true });

  const token = await getAccessToken();
  const manifest = {
    exportedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    label,
    collections: {},
    readTimes: {},
  };

  for (const name of COLLECTIONS) {
    const { docs, readTime } = await runQuery(token, name);
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(docs, null, 2));
    manifest.collections[name] = docs.length;
    if (readTime) manifest.readTimes[name] = readTime;
    process.stdout.write(`${name}: ${docs.length}\n`);
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Self-verification: every file re-parses and matches the manifest count.
  let ok = true;
  for (const name of COLLECTIONS) {
    const parsed = JSON.parse(fs.readFileSync(path.join(outDir, `${name}.json`), 'utf8'));
    if (parsed.length !== manifest.collections[name]) {
      ok = false;
      process.stdout.write(`VERIFY MISMATCH ${name}: file=${parsed.length} manifest=${manifest.collections[name]}\n`);
    }
  }
  const total = Object.values(manifest.collections).reduce((a, b) => a + b, 0);
  process.stdout.write(`Total documents: ${total}\n`);
  process.stdout.write(`Backup dir: ${outDir}\n`);
  process.stdout.write(ok ? 'VERIFIED: all files match manifest counts.\n' : 'VERIFICATION FAILED.\n');
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`Backup failed: ${err.message}\n`);
  process.exit(1);
});

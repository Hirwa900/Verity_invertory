# VERITY Inventory — Express API setup (free-tier, no Blaze plan)

The operations in `functions/src/calls/` (createSale, archiveSale, restoreSale,
createPurchase, adjustStock, createAppUser, updateAppUser) are exposed two ways
from the **same handlers**, so role checks, transactions, stock validation,
audit logging, and idempotency behave identically:

1. **Firebase Cloud Functions** (`functions/src/index.js`) — the original
   callable entry point. Unchanged. Deploying it requires the Blaze plan.
2. **Express API** (`functions/src/server.js`) — this document. Runs on any
   free-tier Node.js host, uses no Blaze-only services (Firestore free tier +
   Auth free tier are enough), and is what the web app calls when
   `VITE_FUNCTIONS_API_BASE` is set.

## Environment variables (server-side only)

| Variable | Required | Purpose |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | **Yes*** | Full service-account key as a **single-line JSON string**. The server refuses to handle operations without it (`/health` reports `configured: false`, calls return 503). |
| `GOOGLE_APPLICATION_CREDENTIALS` | Alternative* | Absolute path to a service-account JSON file, if your host prefers file mounts instead of env vars. |
| `PORT` | No | Listen port. Defaults to `8080`; most hosts (Render, Railway, Fly, Cloud Run) inject `PORT` themselves. |
| `CORS_ORIGINS` | No | Extra allowed origins, comma/space separated (e.g. your custom domain). The Firebase Hosting origins and `localhost` dev origins are always allowed. |

\* Exactly one credential source is needed. **Never assume a key exists** — if
neither variable is set the server still boots and stays safe (503 on calls).

Client-side (`web/.env`, built into the public bundle — **public values only**):

| Variable | Purpose |
|---|---|
| `VITE_FUNCTIONS_API_BASE` | Base URL of this API, e.g. `http://localhost:8080` locally or `https://your-api.onrender.com` after deploy. When unset, the web app falls back to the original Cloud Functions callables. |

> **NEVER put a service account, private key, or password in a `VITE_*`
> variable or anywhere under `web/` — those values are published in the
> browser bundle.**

## 1. Create the service account (you must do this once)

No key is assumed to exist; create one when needed:

1. Firebase Console → **Project settings** (gear icon) → **Service accounts**.
2. **Generate new private key** → downloads a JSON file.
3. Copy the *entire* file content as one line (it is a JSON object starting
   with `{"type":"service_account", ...}`).
4. Store it **only** as the `FIREBASE_SERVICE_ACCOUNT` env var on your host's
   dashboard (see below). Do not commit it; do not paste it into code, chat,
   logs, or frontend files. `serviceAccount*.json` and
   `*-firebase-adminsdk-*.json` are git-ignored as a safety net.
5. Treat the key like a password: rotate it (Firebase Console → Service
   accounts → *Generate new private key*, then delete the old key) if it was
   ever exposed.

## 2. Run locally

```powershell
cd functions
npm install
$env:FIREBASE_SERVICE_ACCOUNT = '{"type":"service_account", ...}'   # PowerShell
npm start                                                            # listens on :8080
```

```bash
# bash
cd functions
npm install
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account", ...}'
npm start
```

Verify:

```powershell
curl http://localhost:8080/health
# {"status":"ok","configured":true}
```

Then run `npm run dev` in `web/` — `web/.env.development` already points the
app at `http://localhost:8080`, so dev uses this API automatically.

> **Production builds:** `vite build` does NOT load `.env.development`.
> `web/.env.production` already sets
> `VITE_FUNCTIONS_API_BASE=https://verity-inventory-api.onrender.com` (the
> blueprint's service name). If Render assigns a different URL, update that
> line and rebuild. Building without it makes the app fall back to Cloud
> Functions callables, which require the Blaze plan.

## 3. Deploy to a free-tier Node.js host

**Render Free via blueprint (recommended):** the repo root contains a
`render.yaml` blueprint (free plan, no billing):

1. Host this repository in your Git account (GitHub/GitLab/Bitbucket) — Render
   deploys from Git. (Nothing is pushed automatically.)
2. Render Dashboard → **New +** → **Blueprint** → pick the repo → Render
   detects `render.yaml` → **Apply**.
3. Dashboard → `verity-inventory-api` → **Environment** → set
   `FIREBASE_SERVICE_ACCOUNT` (the one-line JSON from step 1) → Save
   (triggers a redeploy). Add `CORS_ORIGINS` only for custom domains.
4. Wait for the deploy, then check `https://<name>.onrender.com/health` →
   `{"status":"ok","configured":true}`.

Any other host that runs a plain Node 20+ web server also works (Koyeb,
Fly.io, Railway, Cloud Run — verify current free-tier terms). Generic
instructions:

1. Create a new **Web Service** pointing at this repository, with:
   - **Root directory:** `functions`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Node version:** 20 (or the host's default ≥ 20)
2. In the host's **Environment / Secrets** dashboard, add:
   - `FIREBASE_SERVICE_ACCOUNT` = the one-line JSON from step 1
   - `CORS_ORIGINS` = `https://your-custom-domain.example` (only if you use one)
3. Set the health-check path to `/health`.
4. Deploy, then copy the public base URL
   (e.g. `https://verity-api.onrender.com`) into `web/.env.production` as
   `VITE_FUNCTIONS_API_BASE` and rebuild the web app.
5. Confirm: `GET https://<your-host>/health` returns
   `{"status":"ok","configured":true}`.

Security checklist for the host:

- Secrets go in the host's secret/env-var dashboard — never in the repo,
  never in command arguments you commit, never in `web/`.
- The API only accepts `POST /api/<operation>` with
  `Authorization: Bearer <Firebase ID token>`; Firestore security rules are
  unchanged and still protect direct client access.
- CORS is restricted to the Firebase Hosting origins + localhost (+ your
  `CORS_ORIGINS` additions).
- Error responses never include stack traces; details stay in server logs.
- Free-tier hosts sleep after idle: the first request may take ~30–60 s.

## 4. API reference

```
GET  /health            -> 200 {"status":"ok","configured":true|false}
POST /api/<operation>   Authorization: Bearer <ID token>
     body: {"data": { ... }}            ->  200 {"data": <result>}
     error: {"error": {"code":"<code>","message":"..."}}
```

| Operation | Allowed roles |
|---|---|
| `createSale` | admin, seller |
| `archiveSale`, `restoreSale` | admin |
| `createPurchase`, `adjustStock` | admin |
| `createAppUser`, `updateAppUser` | admin |

Error `code` values are the same Firebase callable codes
(`unauthenticated`, `permission-denied`, `invalid-argument`, `not-found`,
`already-exists`, `failed-precondition`, `internal`, `unavailable`, ...) and
map to conventional HTTP statuses, so `web/src/lib/functions.js` surfaces the
same friendly messages as before.

## 5. Keeping both entry points working

- `functions/src/index.js` (Cloud Functions) is untouched; `npm test` covers
  the handlers plus the Express layer (`test/server.test.js`).
- The web app uses the Express API **only when `VITE_FUNCTIONS_API_BASE` is
  set**; otherwise it keeps using the native callables — no migration cliff.
- No data is migrated or deleted by any of this; Firestore remains the single
  data store for both paths.

# VERITY_INVERTORY — Firebase-Native Rebuild

A clean, production-ready rebuild of Verity Inventory using only Firebase services:

- **Firebase Authentication** (Email/Password, email verification required)
- **Cloud Firestore** (all business data, `verity_` collection prefix)
- **Cloud Functions** (callable — all stock-changing operations are transactional and server-authoritative)
- **Firebase Hosting** (serves the built web app)

There is **no PostgreSQL** dependency. The legacy `frontend/` and `backend/` apps (Express + PostgreSQL) have been removed (they remain in git history at `50acee4` if ever needed).

Everything runs on **free tiers only** (no Cloud Billing / Blaze plan):

- Firebase **Spark** plan: Authentication, Firestore, and Hosting.
- **Render Free** web service: the Express API in `functions/src/server.js`, which reuses the same handlers as the callable functions.

The Cloud Functions entry point (`functions/src/index.js`) is kept as an optional alternative. Deploying it requires the Blaze plan, so it is **not** part of the free deployment path.

## Repository layout

| Path | Purpose |
|---|---|
| `web/` | Vite + React SPA (the new UI). Builds to `web/dist`, served by Firebase Hosting |
| `functions/` | Node 20 handlers (7 operations), the optional callable entry point (`src/index.js`), and the free-tier Express API (`src/server.js`) with mock-based tests |
| `firestore.rules` | Deny-all security rules (admin/seller roles enforced) |
| `firestore.indexes.json` | Composite indexes for sales/products/movements queries |
| `firebase.json` / `.firebaserc` | Firebase project config (project: `verity-inventory`) |
| `render.yaml` | Render Free blueprint for the Express API (no billing, no secrets) |

## Data model (Firestore collections)

All money is stored as **integer cents** (`sellingPriceCents`, `totalCents`, ...). Business dates are stored as `YYYY-MM-DD` strings computed in the **Africa/Kigali** timezone.

| Collection | Key fields | Written by |
|---|---|---|
| `verity_users/{uid}` | name, email, role (admin/seller), isActive | `createAppUser` / `updateAppUser` functions |
| `verity_categories/{id}` | name | Admin client (rules-enforced) |
| `verity_products/{id}` | name, categoryId, sku, unit, buyingPriceCents, sellingPriceCents, **quantity**, minimumQuantity, isActive | Admin client for catalog fields; `quantity` only via functions |
| `verity_sales/{id}` | userId, userName, businessDate, totalCents, isActive, items[] | `createSale` / `archiveSale` / `restoreSale` functions |
| `verity_purchases/{id}` | userId, userName, businessDate, totalCents, items[] | `createPurchase` function |
| `verity_stockMovements/{id}` | productId, type (SALE/PURCHASE/RETURN/ADJUSTMENT), quantity, referenceId, note | Functions only |
| `verity_expenses/{id}` | title, category, amountCents, businessDate | Admin client (rules-enforced) |
| `verity_auditEvents/{id}` | actorId, action, details | Functions only |
| `verity_idempotency/{uid}` | saleId / purchaseId, createdAt | `createSale` / `createPurchase` (duplicate-submit protection) |
| `verity_meta/{id}` | adminGuard: updatedAt, lastCheckedFor | `updateAppUser` only (last-admin serialization guard; client-denied in rules) |

Sales and purchases store embedded `items[]` arrays (product snapshot at time of transaction), so history pages need no join tables.

## Business operations (callable functions or Render HTTP API)

The same seven handlers are exposed two ways:

- **Render Free Express API** (`functions/src/server.js`) — the free deployment path.
  `POST /api/<operation>` with `Authorization: Bearer <Firebase ID token>`,
  body `{"data": {...}}`, response `{"data": ...}`.
  `GET /health` reports `configured: true|false`. The web app calls this when
  `VITE_FUNCTIONS_API_BASE` is set (it is, in `web/.env.production`).
- **Cloud Functions** (`functions/src/index.js`, all `onCall`, authenticated) — optional legacy entry point; deploying it needs Blaze.

| Operation | Caller | Effect |
|---|---|---|
| `createSale` | admin, seller | Validates stock in a transaction, decrements quantity, writes sale + SALE movements + audit + idempotency doc. Requires `clientRequestId` (client sends `crypto.randomUUID()`) |
| `archiveSale` | admin | Sets `isActive=false`, returns stock, logs RETURN movements (reversible "delete") |
| `restoreSale` | admin | Re-activates an archived sale if stock allows |
| `createPurchase` | admin | Increments stock, updates buying price, logs PURCHASE movements. Requires `clientRequestId`; the idempotency record is written in the same transaction as the purchase and stock movements |
| `adjustStock` | admin | Signed quantity change with reason; never allows negative stock |
| `createAppUser` | admin | Creates the Auth user + role claim + `verity_users` profile. If no password is given, returns a generated password **once** (never logged) |
| `updateAppUser` | admin | Updates name/role/active/password; blocks demoting or deactivating the last active admin |

## Security model

- **Rules** (`firestore.rules`): deny-all fallback. Both admin and seller checks require the matching custom claim **and** an active `verity_users` profile with the same role (mismatch ⇒ denied). Clients can never write `quantity`, sales, purchases, movements, audit events, idempotency docs, or `verity_meta` directly.
- **Functions** re-verify claim/profile consistency on every call (`functions/src/lib/context.js`): a missing claim, a claim that does not match the profile role, or an inactive/missing profile is rejected with `permission-denied`. Money paths run inside Firestore transactions (reads before writes).
- **Last-admin protection** (`updateAppUser`): the active-admin count is queried **inside** the transaction, and every such transaction reads **and writes** the sentinel document `verity_meta/adminGuard`. Firestore's optimistic concurrency detects the write-write conflict and retries; on retry the re-count reflects the other transaction's committed change, so concurrent demotions/deactivations cannot leave zero active admins. The sentinel stores no count (the count always comes from the live query), so it cannot drift; it is created on first use. Auth-side mutations (`updateUser`, `setCustomUserClaims`) run only after the transaction commits.
- **Role changes and session refresh**: `updateAppUser` writes the new role to both the profile (Firestore) and the custom claim (Auth). A user's existing ID token keeps the **old** claim until it is refreshed. Enforcement fails closed during the gap: functions require claim==profile, so a stale token is rejected with "Your access level is out of date. Sign out and sign in again." The web app force-refreshes the ID token on every auth-state event (page load — `web/src/context/AuthContext.jsx:24` calls `getIdTokenResult(true)`), so a reload after an admin's change picks up the new role. Sign out/sign in also refreshes. The Users page states this after each update.
- **Login** enforces `emailVerified`; the login page offers "Resend verification email". Password reset uses Firebase's built-in reset email (replaces the legacy reset page).

## Tests

- `functions/`: **48 tests** (`npm test` in `functions/`, all passing) — in-memory mock Firestore (with Firestore-style optimistic-concurrency retries) + mock Auth; cover createSale happy path, insufficient stock, duplicate/concurrent idempotency for sales **and purchases**, purchase idempotency, archive/restore, adjustment bounds, role/permission denials, claim/profile mismatch rejection, the Express API layer (health, bearer auth, CORS, error mapping, idempotency), and concurrent last-admin demotion/deactivation races (exactly one wins, one active admin always remains).
- `web/`: **14 tests** (`npm test` in `web/`) — money helpers, Kigali business date, report computation, login error mapping.
- `web/` **Security Rules integration tests** (`web/rules-tests/firestore.rules.test.js`, **63 assertions** across 16 tests / 4 suites): anonymous access, admin access, seller access, cross-user sales reads, client stock/price manipulation, protected collections, claim/profile mismatch, inactive accounts, and direct role-change attempts. These use `@firebase/rules-unit-testing` against the **Firestore emulator** and are run with:
  ```bash
  # Prerequisites: Java (the emulator requires it), Node 20+
  # From web/: npm install   (firebase-tools and @firebase/rules-unit-testing are devDependencies)
  npm run test:rules
  # = firebase emulators:exec --only firestore --project demo-verity "vitest run --config vitest.rules.config.js"
  ```
  The `demo-verity` project id guarantees the emulator never contacts a real Firebase project. **These tests have NOT been executed on this machine — no Java runtime is installed** (the command fails with `Could not spawn java -version`). They are excluded from the default `npm test` run and must be executed after Java is installed, before deploying rules.

## Firebase web configuration

- `web/.env` holds the Firebase web app config (`VITE_FIREBASE_*`). It is git-ignored and stays local. These are **public client identifiers** (API key, app id) that ship in browser bundles — they are not secrets; the real protection is the Security Rules. `.env` currently contains the `verity-inventory` web-app values and the production build picks them up.
- `web/.env.example` documents the exact variable names for a fresh clone.
- `web/.env.production` (committed, public) sets `VITE_FUNCTIONS_API_BASE=https://verity-inventory-api.onrender.com` so production builds call the Render API instead of falling back to Cloud Functions. If Render assigns a different URL, change this line and rebuild.
- `web/.env.development` points local development at `http://localhost:8080`.
- **Never** place service-account keys, Admin SDK credentials, or any server-side secret under `web/` — those belong only in the Render environment (and locally for `make-admin.js` via `GOOGLE_APPLICATION_CREDENTIALS`).

Rebuild after any change: `npm run build` in `web/`.

## Free deployment (no Cloud Billing / Blaze plan)

Everything below fits on free tiers: Firebase **Spark** (Auth + Firestore + Hosting) and **Render Free** (Express API). **Do not run `firebase deploy --only functions`** — Cloud Functions require Blaze and are not needed.

1. **Firebase project** (`verity-inventory`): enable **Authentication → Email/Password**; create/confirm the Web app; ensure Firestore exists (production mode).
2. **Push this repository to GitHub** (Render deploys from Git).
3. **Render → New + → Blueprint → select the repo → Apply.** `render.yaml` creates the free `verity-inventory-api` web service (`cd functions && npm install`, `cd functions && npm start`, health check `/health`). No secrets are in the blueprint.
4. In Render → `verity-inventory-api` → **Environment**, set `FIREBASE_SERVICE_ACCOUNT` to the one-line JSON service-account key (Firebase Console → Project settings → Service accounts → Generate new private key). Optionally set `CORS_ORIGINS` for a custom domain. Saving redeploys.
5. Verify `https://verity-inventory-api.onrender.com/health` → `{"status":"ok","configured":true}`. If Render gave the service a different hostname, update `web/.env.production` and rebuild before step 7.
6. **Deploy Firestore rules + indexes** (free):
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes
   ```
7. **Build + deploy the web app** (free Firebase Hosting):
   ```bash
   cd web && npm install && npm run build && cd ..
   firebase deploy --only hosting
   ```
8. **Bootstrap the first admin** (locally; uses the service-account key as `GOOGLE_APPLICATION_CREDENTIALS`):
   ```bash
   cd functions && npm install
   # PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\path\to\service-account.json'
   node scripts/make-admin.js --email you@example.com --name "Your Name"
   ```
9. Sign in at `https://verity-inventory.web.app` and use **Manage Users** to create seller accounts.

Optional: run the Rules emulator tests first (`npm run test:rules` in `web/`) if Java is installed.

## What this system does NOT do (by design)

- No data migration from PostgreSQL — all collections start empty. The legacy Express/PostgreSQL system was removed (still recoverable from git history at `50acee4`).
- No billing changes, no deployments, and no GitHub pushes are performed automatically — all gated on your approval. Emulator-based Rules tests exist (`web/rules-tests/`) but have not been executed on this machine because no Java runtime is installed; run `npm run test:rules` in `web/` after installing Java.

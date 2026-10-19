// Express API for the VERITY Inventory business operations.
//
// Reuses the exact handlers deployed as Cloud Functions (./calls/*) so role
// checks, transactions, stock validation, audit logging, and idempotency are
// identical whether the operation runs as a callable function or over HTTP.
//
// Credentials: Firebase Admin credentials come ONLY from server-side
// environment variables (never from committed files or frontend code):
//   FIREBASE_SERVICE_ACCOUNT   JSON string of a service-account key (preferred)
//   GOOGLE_APPLICATION_CREDENTIALS  path to a key file (optional alternative)
//
// Start:  node src/server.js       (PORT env var, default 8080)
// Health: GET /health
// Calls:  POST /api/<operation>    Authorization: Bearer <Firebase ID token>
//         body: { "data": { ... } }  ->  { "data": <result> }
//         error: { "error": { "code": "<firebase code>", "message": "..." } }

'use strict';

const express = require('express');
const cors = require('cors');
const { VALID_CODES } = require('./lib/errors');

const OPERATIONS = [
  'createSale',
  'archiveSale',
  'restoreSale',
  'createPurchase',
  'adjustStock',
  'createAppUser',
  'updateAppUser',
];

const DEFAULT_ORIGINS = [
  'https://verity-inventory.web.app',
  'https://verity-inventory.firebaseapp.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:5176',
];

const STATUS_BY_CODE = {
  'invalid-argument': 400,
  'unauthenticated': 401,
  'permission-denied': 403,
  'not-found': 404,
  'already-exists': 409,
  'aborted': 409,
  'failed-precondition': 412,
  'resource-exhausted': 429,
  'deadline-exceeded': 504,
  'unimplemented': 501,
  'unavailable': 503,
  'internal': 500,
};

const buildAllowedOrigins = () => {
  const fromEnv = String(process.env.CORS_ORIGINS || '')
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...fromEnv]);
};

// Lazily-initialised Admin SDK. Never throws at boot: a missing or invalid
// service account leaves the API running with /health reporting not-configured
// and every operation answering 503 until it is fixed.
let adminState = null;
const ensureAdmin = () => {
  if (adminState) return adminState;
  try {
    const { initializeApp, getApps, cert } = require('firebase-admin/app');
    if (getApps().length) {
      adminState = { ready: true, error: null };
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
      adminState = { ready: true, error: null };
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp();
      adminState = { ready: true, error: null };
    } else {
      adminState = { ready: false, error: 'FIREBASE_SERVICE_ACCOUNT is not set.' };
    }
  } catch (error) {
    adminState = { ready: false, error: `Admin credential error: ${error.message}` };
  }
  return adminState;
};

let runtimeCache = null;
const defaultResolve = () => {
  const admin = ensureAdmin();
  if (!admin.ready) return { ready: false, error: admin.error, handlers: null };
  if (!runtimeCache) {
    const { getFirestore, FieldValue } = require('firebase-admin/firestore');
    const { getAuth } = require('firebase-admin/auth');
    const deps = {
      db: getFirestore(),
      auth: getAuth(),
      now: () => FieldValue.serverTimestamp(),
    };
    const handlers = {};
    for (const name of OPERATIONS) handlers[name] = require(`./calls/${name}`)(deps);
    runtimeCache = handlers;
  }
  return { ready: true, error: null, handlers: runtimeCache };
};

const defaultVerifyIdToken = (token) => {
  const { getAuth } = require('firebase-admin/auth');
  return getAuth().verifyIdToken(token);
};

const extractData = (body) => {
  if (body && typeof body === 'object' && !Array.isArray(body)
    && Object.prototype.hasOwnProperty.call(body, 'data')) {
    return body.data === undefined || body.data === null ? {} : body.data;
  }
  return body && typeof body === 'object' ? body : {};
};

const createApp = (overrides = {}) => {
  const app = express();
  const allowedOrigins = buildAllowedOrigins();
  const resolve = overrides.resolve || defaultResolve;
  const verifyIdToken = overrides.verifyIdToken || defaultVerifyIdToken;

  app.use(cors({
    origin(origin, callback) {
      // No Origin header: same-origin tools (curl, server-to-server) pass.
      callback(null, !origin || allowedOrigins.has(origin));
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    optionsSuccessStatus: 204,
  }));

  app.use(express.json({ limit: '512kb' }));

  app.get('/health', (req, res) => {
    const runtime = resolve();
    res.json({ status: 'ok', configured: Boolean(runtime.ready) });
  });

  app.post('/api/:name', async (req, res) => {
    const runtime = resolve();
    if (!runtime.ready) {
      console.error('API call rejected: server not configured.', runtime.error);
      return res.status(503).json({
        error: { code: 'unavailable', message: 'The server is unavailable. Try again later.' },
      });
    }

    const header = req.headers.authorization || '';
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match) {
      return res.status(401).json({
        error: { code: 'unauthenticated', message: 'Sign in required.' },
      });
    }

    let decoded;
    try {
      decoded = await verifyIdToken(match[1]);
    } catch (error) {
      console.error('ID token verification failed:', error.message);
      return res.status(401).json({
        error: { code: 'unauthenticated', message: 'Your session has expired. Sign in again.' },
      });
    }

    const name = req.params.name;
    const handler = runtime.handlers[name];
    if (!OPERATIONS.includes(name) || !handler) {
      return res.status(404).json({
        error: { code: 'not-found', message: 'Unknown operation.' },
      });
    }

    try {
      // Same shape the callable receives: { auth: { uid, token } } where token
      // is the decoded ID token (custom claims at the top level).
      const context = { auth: { uid: decoded.uid, token: decoded } };
      const result = await handler(extractData(req.body), context);
      return res.json({ data: result === undefined ? null : result });
    } catch (error) {
      if (error && error.code && VALID_CODES.has(error.code)) {
        const status = STATUS_BY_CODE[error.code] || 500;
        return res.status(status).json({ error: { code: error.code, message: error.message } });
      }
      console.error(`Unhandled error in ${name}:`, error);
      return res.status(500).json({
        error: { code: 'internal', message: 'An unexpected error occurred.' },
      });
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: { code: 'not-found', message: 'Not found.' } });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (error && error.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: { code: 'invalid-argument', message: 'Request body must be valid JSON.' },
      });
    }
    if (error && error.type === 'entity.too.large') {
      return res.status(413).json({
        error: { code: 'invalid-argument', message: 'Request body is too large.' },
      });
    }
    console.error('Unexpected request error:', error);
    res.status(500).json({
      error: { code: 'internal', message: 'An unexpected error occurred.' },
    });
  });

  return app;
};

if (require.main === module) {
  const port = Number(process.env.PORT) || 8080;
  createApp().listen(port, () => {
    console.log(`VERITY Inventory API listening on port ${port}`);
    if (!ensureAdmin().ready) {
      console.warn('WARNING: not configured. Set FIREBASE_SERVICE_ACCOUNT (JSON service-account key) to enable operations.');
    }
  });
}

module.exports = { createApp, OPERATIONS, DEFAULT_ORIGINS };

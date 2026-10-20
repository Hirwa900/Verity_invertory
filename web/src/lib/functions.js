import { httpsCallable } from 'firebase/functions';
import { auth, functions } from './firebase';
import { bumpDataRevision } from './queryCache';

export class FunctionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FunctionError';
    this.code = code;
  }
}

const FRIENDLY_MESSAGES = {
  'unauthenticated': 'You are not signed in. Please sign in again.',
  'permission-denied': 'You do not have permission to do that.',
  'invalid-argument': null,
  'not-found': null,
  'already-exists': null,
  'failed-precondition': null,
  'internal': 'Something went wrong on the server. Please try again.',
  'unavailable': 'The server is unavailable. Check your connection and try again.',
  'deadline-exceeded': 'The request took too long. Please try again.',
};

export function friendlyFunctionMessage(error) {
  if (error instanceof FunctionError) {
    return FRIENDLY_MESSAGES[error.code] ?? error.message;
  }
  return error?.message || 'Something went wrong. Please try again.';
}

// Base URL of the Express API that reuses functions/src/calls handlers.
// Set VITE_FUNCTIONS_API_BASE (e.g. https://your-api.onrender.com) at build
// time. It must be a server origin only — never put credentials in VITE_*
// variables; they are public in the browser bundle.
const API_BASE = String(import.meta.env.VITE_FUNCTIONS_API_BASE || '').replace(/\/+$/, '');

async function callViaApi(name, data) {
  let token = null;
  try {
    token = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
  } catch {
    throw new FunctionError('unauthenticated', 'Your session has expired. Sign in again.');
  }
  if (!token) {
    throw new FunctionError('unauthenticated', 'You are not signed in. Please sign in again.');
  }

  let response;
  try {
    response = await fetch(`${API_BASE}/api/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ data: data === undefined ? {} : data }),
    });
  } catch {
    throw new FunctionError('unavailable', 'The server is unavailable. Check your connection and try again.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON response; handled below.
  }

  if (!response.ok) {
    const problem = payload && payload.error;
    // Sleeping free-tier hosts and their proxies answer 502/503/504 with
    // non-JSON bodies; surface those as a retryable 'unavailable'.
    if (!problem && [502, 503, 504, 521, 522, 524].includes(response.status)) {
      throw new FunctionError('unavailable', 'The server is unavailable. Check your connection and try again.');
    }
    throw new FunctionError(problem?.code || 'internal', problem?.message || 'Request failed.');
  }
  // A committed business write invalidates cached product/category reads.
  bumpDataRevision();
  return payload ? payload.data : null;
}

export async function call(name, data) {
  if (API_BASE) {
    return callViaApi(name, data);
  }
  // Fallback: native Cloud Functions callable (legacy path) when no API base
  // is configured, so existing deployments keep working during migration.
  if (!functions) {
    throw new FunctionError('unavailable', 'Firebase is not configured.');
  }
  const callable = httpsCallable(functions, name);
  try {
    const result = await callable(data);
    bumpDataRevision();
    return result.data;
  } catch (error) {
    throw new FunctionError(error?.code || 'internal', error?.message || 'Request failed.');
  }
}

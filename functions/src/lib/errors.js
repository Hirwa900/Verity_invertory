class HttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'HttpsError';
    this.code = code;
  }
}

const invalid = (message) => new HttpsError('invalid-argument', message);
const notFound = (message) => new HttpsError('not-found', message);
const denied = (message = 'Access denied.') => new HttpsError('permission-denied', message);
const failed = (message) => new HttpsError('failed-precondition', message);
const conflict = (message) => new HttpsError('already-exists', message);
const unauthenticated = (message = 'Sign in required.') => new HttpsError('unauthenticated', message);

const VALID_CODES = new Set([
  'ok', 'cancelled', 'unknown', 'invalid-argument', 'deadline-exceeded',
  'already-exists', 'permission-denied', 'resource-exhausted', 'failed-precondition',
  'aborted', 'out-of-range', 'unimplemented', 'internal', 'unavailable', 'unauthenticated',
]);

module.exports = { HttpsError, invalid, notFound, denied, failed, conflict, unauthenticated, VALID_CODES };

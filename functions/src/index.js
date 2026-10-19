const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { HttpsError: AppError, VALID_CODES } = require('./lib/errors');

initializeApp();

const db = getFirestore();
const auth = getAuth();
const now = () => FieldValue.serverTimestamp();
const deps = { db, auth, now };

const adapt = (handler) =>
  onCall(async (request) => {
    try {
      return await handler(request.data || {}, request);
    } catch (error) {
      if (error instanceof AppError) {
        const code = VALID_CODES.has(error.code) ? error.code : 'internal';
        throw new HttpsError(code, error.message);
      }
      console.error('Unhandled function error:', error);
      throw new HttpsError('internal', 'An unexpected error occurred.');
    }
  });

exports.createSale = adapt(require('./calls/createSale')(deps));
exports.archiveSale = adapt(require('./calls/archiveSale')(deps));
exports.restoreSale = adapt(require('./calls/restoreSale')(deps));
exports.createPurchase = adapt(require('./calls/createPurchase')(deps));
exports.adjustStock = adapt(require('./calls/adjustStock')(deps));
exports.createAppUser = adapt(require('./calls/createAppUser')(deps));
exports.updateAppUser = adapt(require('./calls/updateAppUser')(deps));

#!/usr/bin/env node
// Creates (or promotes) an admin account: Firebase Auth user + role claim +
// verity_users profile. Run locally with GOOGLE_APPLICATION_CREDENTIALS set:
//   node scripts/make-admin.js --email admin@example.com --name "Admin Name"
// Optional: --password <min 8 chars> (otherwise a random one is printed once).

const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (!request.startsWith('.') && !path.isAbsolute(request)) {
    try {
      return origResolve.call(this, request, parent, isMain, {
        ...(options || {}),
        paths: [path.join(__dirname, '..'), ...((options && options.paths) || [])],
      });
    } catch { /* fall through */ }
  }
  return origResolve.call(this, request, parent, isMain, options);
};

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

const email = (getArg('email') || '').trim().toLowerCase();
const name = (getArg('name') || '').trim();
let password = getArg('password');

if (!email || !name) {
  console.error('Usage: node scripts/make-admin.js --email <email> --name "<name>" [--password <pw>]');
  process.exit(1);
}

(async () => {
  const { initializeApp, applicationDefault, getApps } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const { getFirestore, FieldValue } = require('firebase-admin/firestore');

  const projectId = process.env.FIREBASE_PROJECT_ID || 'verity-inventory';
  if (!getApps().length) {
    initializeApp({ credential: applicationDefault(), projectId });
  }
  const auth = getAuth();
  const db = getFirestore();

  const generated = !password;
  if (generated) password = crypto.randomBytes(12).toString('base64url');
  else if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { displayName: name, password, disabled: false });
    console.log(`Updated existing Auth account for ${email}`);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    user = await auth.createUser({ email, password, displayName: name, emailVerified: true });
    console.log(`Created Auth account for ${email}`);
  }

  await auth.setCustomUserClaims(user.uid, { role: 'admin' });
  await db.doc(`verity_users/${user.uid}`).set({
    name,
    email,
    role: 'admin',
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: 'make-admin-script',
  }, { merge: true });

  console.log(`User ${email} is now an admin (uid: ${user.uid}).`);
  if (generated) console.log(`Generated password (shown once, not stored): ${password}`);
  process.exit(0);
})().catch((e) => {
  console.error('make-admin failed:', e.message);
  process.exit(1);
});

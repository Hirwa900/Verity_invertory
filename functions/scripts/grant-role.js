#!/usr/bin/env node
// Grants an EXISTING Firebase Auth account its app role, without ever
// touching the account's password or creating/deleting any user.
//
// It performs exactly two cloud writes + one audit record:
//   1. auth.setCustomUserClaims(uid, { role })      (the role claim rules require)
//   2. verity_users/{uid} profile upsert, {merge:true}  (never deletes fields)
//   3. a verity_auditEvents record
//
// Run locally with Application Default Credentials:
//   node scripts/grant-role.js --email admin@example.com
//   node scripts/grant-role.js --uid <uid> --role admin --name "Beni"
//
// Role resolution order: --role flag, then an existing verity_users/{uid}.role,
// then an existing users/{uid}.role (the legacy console collection). The script
// refuses to run if the result is not 'admin' or 'seller'.
// It NEVER reads, sets, prints, or resets any password.

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

const email = (getArg('email') || '').trim().toLowerCase();
const uidArg = (getArg('uid') || '').trim();
const roleArg = (getArg('role') || '').trim();
const nameArg = (getArg('name') || '').trim();

if (!email && !uidArg) {
  console.error('Usage: node scripts/grant-role.js --email <email> | --uid <uid>  [--role admin|seller] [--name "<display name>"]');
  process.exit(1);
}
if (roleArg && !['admin', 'seller'].includes(roleArg)) {
  console.error("Role must be 'admin' or 'seller'.");
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

  let user;
  try {
    user = email ? await auth.getUserByEmail(email) : await auth.getUser(uidArg);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      console.error('No such Auth account exists. Create it in Firebase Console > Authentication first (this script never creates users).');
      process.exit(1);
    }
    throw e;
  }

  const canonicalSnap = await db.doc(`verity_users/${user.uid}`).get();
  const legacySnap = await db.doc(`users/${user.uid}`).get();
  const canonical = canonicalSnap.exists ? canonicalSnap.data() : null;
  const legacy = legacySnap.exists ? legacySnap.data() : null;

  const role = roleArg || (canonical && canonical.role) || (legacy && legacy.role) || null;
  if (!['admin', 'seller'].includes(role)) {
    console.error('Could not determine a role. Pass --role admin or --role seller.');
    process.exit(1);
  }

  const name = nameArg || (canonical && canonical.name) || (legacy && legacy.name) || user.displayName || user.email;
  const isActive = canonical ? canonical.isActive !== false : legacy ? legacy.isActive !== false : true;

  await auth.setCustomUserClaims(user.uid, { role });

  await db.doc(`verity_users/${user.uid}`).set({
    name,
    email: user.email || (canonical && canonical.email) || (legacy && legacy.email) || '',
    role,
    isActive,
    updatedAt: FieldValue.serverTimestamp(),
    grantedBy: 'grant-role-script',
  }, { merge: true });

  await db.collection('verity_auditEvents').doc().set({
    actorId: user.uid,
    actorName: name,
    action: 'user.grant-role',
    details: { uid: user.uid, role },
    createdAt: FieldValue.serverTimestamp(),
  });

  console.log(`Granted role '${role}' to ${user.email || user.uid} (uid: ${user.uid}).`);
  console.log('Profile ensured at verity_users/' + user.uid + ' (merge only; nothing deleted).');
  console.log('If they are signed in already, they must reload the page (or sign out and back in) for the new role to take effect.');
  process.exit(0);
})().catch((e) => {
  console.error('grant-role failed:', e.message);
  process.exit(1);
});

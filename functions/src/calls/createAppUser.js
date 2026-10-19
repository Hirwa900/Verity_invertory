const crypto = require('crypto');
const { requireUser, requireRole } = require('../lib/context');
const { invalid } = require('../lib/errors');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = ({ db, now, auth }) => async (data, context) => {
  const admin = requireRole(await requireUser(db, context && context.auth), ['admin']);

  const email = String((data && data.email) || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) throw invalid('A valid email is required.');
  const name = String((data && data.name) || '').trim();
  if (!name || name.length > 100) throw invalid('A name (max 100 characters) is required.');
  const role = String((data && data.role) || '').trim();
  if (!['admin', 'seller'].includes(role)) throw invalid('Role must be admin or seller.');

  let password = typeof data.password === 'string' && data.password ? data.password : null;
  let generatedPassword = null;
  if (password !== null) {
    if (password.length < 8) throw invalid('Password must be at least 8 characters.');
  } else {
    generatedPassword = crypto.randomBytes(12).toString('base64url');
    password = generatedPassword;
  }

  const existing = await auth.getUserByEmail(email).catch((e) => {
    if (e && e.code === 'auth/user-not-found') return null;
    throw e;
  });
  if (existing) throw invalid('An account with this email already exists.');

  const created = await auth.createUser({ email, password, displayName: name, emailVerified: true });
  await auth.setCustomUserClaims(created.uid, { role });

  const profileRef = db.doc(`verity_users/${created.uid}`);
  await profileRef.set({
    name,
    email,
    role,
    isActive: true,
    createdAt: now(),
    createdBy: admin.uid,
  });
  await db.collection('verity_auditEvents').doc().set({
    actorId: admin.uid,
    actorName: admin.name,
    action: 'user.create',
    details: { uid: created.uid, email, role },
    createdAt: now(),
  });

  return { uid: created.uid, generatedPassword };
};

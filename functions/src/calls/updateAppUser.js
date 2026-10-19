const { requireUser, requireRole } = require('../lib/context');
const { invalid, notFound, failed } = require('../lib/errors');

const ADMIN_GUARD_PATH = 'verity_meta/adminGuard';

module.exports = ({ db, now, auth }) => async (data, context) => {
  const admin = requireRole(await requireUser(db, context && context.auth), ['admin']);

  const uid = String((data && data.uid) || '').trim();
  if (!uid) throw invalid('A user id is required.');

  const authUser = await auth.getUser(uid).catch(() => null);
  if (!authUser) throw notFound('No authentication account exists for this user.');

  const updates = {};
  let newRole = null;
  let newActive = null;
  let newPassword = null;

  await db.runTransaction(async (t) => {
    const profileRef = db.doc(`verity_users/${uid}`);
    const guardRef = db.doc(ADMIN_GUARD_PATH);

    const profileSnap = await t.get(profileRef);
    if (!profileSnap.exists) throw notFound('User not found.');
    const profile = profileSnap.data();

    newRole = profile.role;
    newActive = profile.isActive !== false;

    if (data.name !== undefined) {
      const name = String(data.name).trim();
      if (!name || name.length > 100) throw invalid('A name (max 100 characters) is required.');
      updates.name = name;
    }
    if (data.role !== undefined) {
      newRole = String(data.role).trim();
      if (!['admin', 'seller'].includes(newRole)) throw invalid('Role must be admin or seller.');
      updates.role = newRole;
    }
    if (data.isActive !== undefined) {
      newActive = data.isActive === true;
      updates.isActive = newActive;
    }
    if (data.password !== undefined && data.password !== null && data.password !== '') {
      if (String(data.password).length < 8) throw invalid('Password must be at least 8 characters.');
      newPassword = String(data.password);
    }

    const losesAdmin = profile.role === 'admin' && (newRole !== 'admin' || newActive !== true);
    if (losesAdmin) {
      const adminsSnap = await t.get(
        db.collection('verity_users')
          .where('role', '==', 'admin')
          .where('isActive', '==', true),
      );
      const activeAdmins = adminsSnap.size !== undefined
        ? adminsSnap.size
        : adminsSnap.docs.length;
      if (activeAdmins <= 1) throw failed('At least one active admin account must remain.');
    }

    await t.get(guardRef);

    updates.updatedAt = now();
    t.update(profileRef, updates);
    t.set(guardRef, { updatedAt: now(), lastCheckedFor: uid });
  });

  await auth.updateUser(uid, {
    ...(updates.name !== undefined ? { displayName: updates.name } : {}),
    ...(newPassword ? { password: newPassword } : {}),
    disabled: newActive !== true,
  });
  await auth.setCustomUserClaims(uid, { role: newRole });

  await db.collection('verity_auditEvents').doc().set({
    actorId: admin.uid,
    actorName: admin.name,
    action: 'user.update',
    details: { uid, changed: Object.keys(updates).filter((k) => k !== 'updatedAt') },
    createdAt: now(),
  });

  return { uid };
};

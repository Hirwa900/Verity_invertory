import { describe, it, expect } from 'vitest';
import { buildAuthUser } from '../context/AuthContext';

const firebaseUser = (overrides = {}) => ({
  uid: 'u1',
  email: 'user@example.com',
  emailVerified: true,
  displayName: 'Display Name',
  ...overrides,
});

describe('buildAuthUser', () => {
  it('prefers profile values over claims and the Firebase profile', () => {
    const user = buildAuthUser(
      firebaseUser(),
      { claims: { name: 'Token Name', role: 'seller' } },
      { name: 'Profile Name', role: 'admin', isActive: false },
    );
    expect(user.uid).toBe('u1');
    expect(user.email).toBe('user@example.com');
    expect(user.emailVerified).toBe(true);
    expect(user.name).toBe('Profile Name');
    expect(user.role).toBe('admin');
    expect(user.isActive).toBe(false);
  });

  it('falls back to token claims when the profile is missing', () => {
    const user = buildAuthUser(firebaseUser(), { claims: { name: 'Token Name', role: 'seller' } }, null);
    expect(user.name).toBe('Token Name');
    expect(user.role).toBe('seller');
    expect(user.isActive).toBe(true);
  });

  it('falls back to the Firebase profile when profile and claims are missing', () => {
    const user = buildAuthUser(firebaseUser(), null, null);
    expect(user.name).toBe('Display Name');
    expect(user.role).toBe(null);
    expect(user.isActive).toBe(true);
  });

  it('uses the email as the last-resort name', () => {
    const user = buildAuthUser(firebaseUser({ displayName: null }), null, null);
    expect(user.name).toBe('user@example.com');
  });

  it('treats a profile without an explicit isActive flag as active', () => {
    const user = buildAuthUser(firebaseUser(), null, { name: 'N', role: 'seller' });
    expect(user.isActive).toBe(true);
  });
});

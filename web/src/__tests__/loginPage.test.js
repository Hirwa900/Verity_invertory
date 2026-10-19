import { describe, it, expect } from 'vitest';
import { isUnverifiedEmailError, resendErrorMessage } from '../pages/LoginPage';

describe('login error helpers', () => {
  it('detects the unverified-email error by code', () => {
    const error = new Error('not verified');
    error.code = 'auth/unverified-email';
    expect(isUnverifiedEmailError(error)).toBe(true);
    expect(isUnverifiedEmailError(new Error('other'))).toBe(false);
    expect(isUnverifiedEmailError(null)).toBe(false);
  });

  it('maps resend failures to friendly messages', () => {
    expect(resendErrorMessage({ code: 'auth/wrong-password' })).toMatch(/incorrect/i);
    expect(resendErrorMessage({ code: 'auth/too-many-requests' })).toMatch(/wait/i);
    expect(resendErrorMessage({ code: 'auth/network-request-failed' })).toMatch(/network/i);
    expect(resendErrorMessage({ code: 'auth/quota-exceeded' })).toMatch(/quota/i);
    expect(resendErrorMessage({ code: 'auth/user-disabled' })).toMatch(/disabled/i);
    expect(resendErrorMessage({ code: 'auth/invalid-api-key' })).toMatch(/configured/i);
    expect(resendErrorMessage({})).toMatch(/try again/i);
  });
});

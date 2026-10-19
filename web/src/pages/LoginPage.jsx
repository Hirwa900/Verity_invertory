import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

const UNVERIFIED_EMAIL_CODE = 'auth/unverified-email';
const UNVERIFIED_FALLBACK =
  'Your email address has not been verified yet. Verify it, then sign in again.';

const INVALID_CREDENTIAL_CODES = new Set([
  'auth/invalid-credential',
  'auth/wrong-password',
  'auth/user-not-found',
  'auth/invalid-email',
  'auth/missing-password',
  'auth/missing-email',
]);

const FIREBASE_CONFIG_CODES = new Set([
  'auth/invalid-api-key',
  'auth/api-key-not-valid',
  'auth/configuration-not-found',
  'auth/operation-not-allowed',
  'auth/internal-error',
]);

function unverifiedEmailError(message) {
  const error = new Error(message || UNVERIFIED_FALLBACK);
  error.code = UNVERIFIED_EMAIL_CODE;
  return error;
}

export function isUnverifiedEmailError(error) {
  return Boolean(error) && error.code === UNVERIFIED_EMAIL_CODE;
}

export async function tryFirebaseLogin(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  if (!credential.user.emailVerified) {
    await signOutQuietly();
    throw unverifiedEmailError();
  }
  await credential.user.getIdToken(true);
  return credential.user;
}

async function signOutQuietly() {
  try {
    await signOut(auth);
  } catch { /* ignore */ }
}

export async function sendVerificationEmailForLogin(loginEmail, loginPassword, authInstance = auth) {
  const credential = await signInWithEmailAndPassword(authInstance, loginEmail, loginPassword);
  if (credential?.user?.emailVerified) {
    await signOutQuietly();
    return { status: 'already-verified' };
  }
  await sendEmailVerification(credential.user);
  await signOutQuietly();
  return { status: 'sent' };
}

export function resendErrorMessage(error) {
  const code = error?.code;
  if (INVALID_CREDENTIAL_CODES.has(code)) {
    return 'Email or password is incorrect. Check your details and try again.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error. Check your connection and try again.';
  }
  if (code === 'auth/quota-exceeded') {
    return "Firebase's email quota has been reached. Please try again later or contact an administrator.";
  }
  if (code === 'auth/user-disabled') {
    return 'This account has been disabled. Contact an administrator.';
  }
  if (FIREBASE_CONFIG_CODES.has(code)) {
    return 'Firebase sign-in is not configured correctly. Contact an administrator.';
  }
  return 'Could not send the verification email. Please try again.';
}

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [roleIssue, setRoleIssue] = useState(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!user) {
      setRoleIssue(null);
      return;
    }
    if (user.isActive && ['admin', 'seller'].includes(user.role)) {
      setRoleIssue(null);
      navigate(user.role === 'admin' ? '/dashboard' : '/new-sale', { replace: true });
      return;
    }
    setNotice(null);
    setError(null);
    setRoleIssue(
      'You are signed in, but this account does not have an active app role yet. '
      + 'An administrator must grant your role before you can continue.',
    );
  }, [user, navigate]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setNeedsVerification(false);
    setLoading(true);

    try {
      if (!isFirebaseConfigured) {
        setError('Firebase is not configured. Set the VITE_FIREBASE_* variables in web/.env.');
        return;
      }
      if (forgotMode) {
        await sendPasswordResetEmail(auth, email);
        setNotice('Password reset email sent. Open the link in that email to choose a new password.');
        return;
      }

      // AuthContext picks the session up via onAuthStateChanged; the effect
      // above routes once the profile role is known.
      await tryFirebaseLogin(email, password);
      setNotice('Signed in. Loading…');
    } catch (loginError) {
      if (isUnverifiedEmailError(loginError)) {
        setNeedsVerification(true);
        setError(loginError.message);
      } else if (loginError?.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please wait a moment and try again.');
      } else if (loginError?.code === 'auth/user-disabled') {
        setError('This account has been disabled. Contact an administrator.');
      } else if (INVALID_CREDENTIAL_CODES.has(loginError?.code)) {
        setError('Email or password is incorrect. Check your details and try again.');
      } else if (FIREBASE_CONFIG_CODES.has(loginError?.code)) {
        setError('Firebase sign-in is not configured correctly. Contact an administrator.');
      } else {
        setError(loginError?.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      const result = await sendVerificationEmailForLogin(email, password);
      if (result.status === 'already-verified') {
        setNeedsVerification(false);
        setNotice('Your email is already verified. Select Sign in to continue.');
      } else {
        setNotice('Verification email sent. Open the link in that email, then sign in again.');
      }
    } catch (resendError) {
      setError(resendErrorMessage(resendError));
    } finally {
      setResending(false);
    }
  };

  const initials = 'VI';

  return (
    <div className="login-page">
      <div className="login-brand-panel">
        <div className="login-brand-inner">
          <div className="login-brand-logo">
            <span className="login-brand-symbol">🏭</span>
          </div>
          <div className="login-brand-name">Verity Inventory</div>
          <h1 className="login-brand-tagline">
            Manage your stock,<br />sales &amp; purchases with ease.
          </h1>
          <p className="login-brand-sub">
            A complete inventory management system designed to help your business
            run smoothly, track products, and stay ahead.
          </p>
          <div className="login-brand-stats">
            <div className="login-stat">
              <span className="login-stat-value">100%</span>
              <span className="login-stat-label">Control</span>
            </div>
            <div className="login-stat">
              <span className="login-stat-value">24/7</span>
              <span className="login-stat-label">Access</span>
            </div>
            <div className="login-stat">
              <span className="login-stat-value">Secure</span>
              <span className="login-stat-label">Data</span>
            </div>
          </div>
        </div>
      </div>

      <div className="login-form-panel">
        <div className="login-form-wrap">
          <div className="login-mobile-head">
            <div className="login-brand-logo sm">
              <span className="login-brand-symbol">🏭</span>
            </div>
            <div className="login-brand-name">Verity Inventory</div>
          </div>

          <h2 className="login-title">{forgotMode ? 'Reset your password' : 'Welcome back'}</h2>
          <p className="login-subtitle">
            {forgotMode ? 'Enter your email to receive a secure reset link.' : 'Sign in to your account to continue'}
          </p>

          <form onSubmit={handleLogin} className="login-form" noValidate>
            <div className="login-field">
              <label htmlFor="email">Email address</label>
              <div className="login-input-wrap">
                <span className="login-input-icon">✉</span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {!forgotMode && <div className="login-field">
              <div className="login-field-label-row">
                <label htmlFor="password">Password</label>
                <button
                  type="button"
                  className="login-toggle-password"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="login-input-wrap">
                <span className="login-input-icon">🔒</span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>}

            {error && <div className="login-error" role="alert">{error}</div>}
            {notice && <div className="login-notice" role="status">{notice}</div>}
            {roleIssue && (
              <>
                <div className="login-error" role="alert">{roleIssue}</div>
                <button type="button" className="login-helper-link" onClick={() => logout()}>
                  Sign out
                </button>
              </>
            )}

            {needsVerification && !forgotMode && (
              <button
                type="button"
                className="login-helper-link"
                onClick={handleResendVerification}
                disabled={resending || loading}
              >
                {resending ? 'Sending verification email…' : 'Resend verification email'}
              </button>
            )}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? (forgotMode ? 'Sending…' : 'Signing in…') : (forgotMode ? 'Send reset link' : 'Sign in')}
            </button>
            <button
              type="button"
              className="login-helper-link"
              onClick={() => {
                setForgotMode((current) => !current);
                setError(null);
                setNotice(null);
                setNeedsVerification(false);
              }}
            >
              {forgotMode ? 'Back to sign in' : 'Forgot password?'}
            </button>
          </form>

          <div className="login-footer">
            <span className="login-avatar">{initials}</span>
            <p>Secured by Verity Inventory</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;

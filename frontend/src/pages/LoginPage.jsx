import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await axios.post('/api/auth/login', {
        email,
        password,
      });

      localStorage.setItem('authToken', response.data.token);
      localStorage.setItem('authUser', JSON.stringify(response.data.user));
      navigate('/dashboard');
    } catch (loginError) {
      setError(loginError.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
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

          <h2 className="login-title">Welcome back</h2>
          <p className="login-subtitle">Sign in to your account to continue</p>

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

            <div className="login-field">
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
            </div>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
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


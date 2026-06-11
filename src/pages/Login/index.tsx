import React, { useState } from 'react';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, setMemoryToken } from '../../services/api';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';


const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, token } = useAuth();

  const from = location.state?.from?.pathname + (location.state?.from?.search || '') || '/';

  // Already logged in → go home
  if (token) return <Navigate to={from} replace />;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setMemoryToken(data.token);
      login(data.user, data.token);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/auth/google', { idToken: credentialResponse.credential });
      const { token, user } = response.data;
      setMemoryToken(token);
      login(user, token);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Decorative background blurs */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          bottom: '-80px',
          left: '-80px',
          width: '320px',
          height: '320px',
          background: 'rgba(166,228,46,0.15)',
          borderRadius: '50%',
          filter: 'blur(120px)',
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'fixed',
          bottom: '-160px',
          right: '-160px',
          width: '600px',
          height: '600px',
          border: '1px solid var(--border-subtle)',
          borderRadius: '50%',
          opacity: 0.2,
          pointerEvents: 'none',
        }}
      />

      {/* Login card */}
      <main
        style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '440px' }}
        className="animate-fade-in-up"
      >
        {/* Brand mark */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--primary)' }}>signal_cellular_alt</span>
            <h1 className="type-display-lg" style={{ fontSize: '32px', letterSpacing: '-0.02em' }}>Lakeside</h1>
          </div>
          <p className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Enterprise Video Infrastructure
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'var(--surface-container-lowest)',
            border: '1px solid var(--border-subtle)',
            padding: '48px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Lime top accent line */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', background: 'var(--vibrant-lime)' }} />

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label htmlFor="login-email" className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="input-underline"
              />
            </div>

            {/* Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label htmlFor="login-password" className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>
                  Password
                </label>
                <a href="#" className="type-label-sm" style={{ color: 'var(--primary)', textDecoration: 'none', letterSpacing: '0.05em' }}>
                  FORGOT?
                </a>
              </div>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input-underline"
              />
            </div>

            {error && (
              <p className="type-label-sm" style={{ color: 'var(--error)', letterSpacing: '0.03em' }}>{error}</p>
            )}

            {/* Submit */}
            <div style={{ paddingTop: '8px' }}>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
                style={{ width: '100%', padding: '16px', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Authenticating…' : 'Login'}
              </button>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
              <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            </div>

            {/* Google button */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', filter: 'grayscale(100%)' }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign in failed.')}
                theme="outline"
                size="large"
                shape="rectangular"
                width="100%"
              />
            </div>
          </form>
        </div>


        {/* Footer link */}
        <div style={{ marginTop: '32px', textAlign: 'center' }}>
          <p className="type-body-md" style={{ color: 'var(--on-surface-variant)' }}>
            Don't have an account?{' '}
            <a
              href="/signup"
              onClick={(e) => { e.preventDefault(); navigate('/signup', { state: { from: location.state?.from } }); }}
              style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'underline', textDecorationColor: 'var(--vibrant-lime)', textDecorationThickness: '2px', textUnderlineOffset: '4px' }}
            >
              Register Now
            </a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default Login;

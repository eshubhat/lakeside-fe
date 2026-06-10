import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { api, setMemoryToken } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';


const Signup: React.FC = () => {
  const navigate = useNavigate();
  const { signup, token } = useAuth();

  // Already logged in → go home
  if (token) return <Navigate to="/" replace />;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/auth/signup', { name, email, password });
      setMemoryToken(data.token);
      signup(data.user, data.token);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Registration failed. Please try again.');
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
      signup(user, token);
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--surface-container-lowest)',
          borderBottom: '1px solid var(--border-subtle)',
          height: '80px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 40px',
        }}
      >
        <div style={{ maxWidth: 'var(--container-max)', width: '100%', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            className="type-display-lg"
            style={{ fontSize: '32px', cursor: 'pointer' }}
            onClick={() => navigate('/')}
          >
            Lakeside
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <a href="#" className="type-button" style={{ color: 'var(--on-surface-variant)', textDecoration: 'none' }}>Support</a>
            <button
              className="btn-primary"
              onClick={() => navigate('/login')}
              style={{ padding: '8px 24px' }}
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 16px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background lime glow */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
            width: '800px',
            height: '800px',
            background: 'rgba(166,228,46,0.05)',
            borderRadius: '50%',
            filter: 'blur(120px)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        {/* Registration card */}
        <div
          className="animate-fade-in-up"
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            maxWidth: '480px',
            background: '#ffffff',
            border: '1px solid var(--primary)',
            padding: '48px',
          }}
        >
          <div style={{ marginBottom: '48px' }}>
            <h1 className="type-headline-lg" style={{ marginBottom: '8px' }}>Create your account</h1>
            <p className="type-body-md" style={{ color: 'var(--on-surface-variant)' }}>
              Join the next generation of high-fidelity communication.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
            <FloatingInput id="reg-name" label="Full Name" type="text" value={name} onChange={setName} />
            <FloatingInput id="reg-email" label="Email Address" type="email" value={email} onChange={setEmail} />
            <FloatingInput id="reg-password" label="Password" type="password" value={password} onChange={setPassword} />
            <FloatingInput id="reg-confirm" label="Confirm Password" type="password" value={confirmPassword} onChange={setConfirmPassword} />

            {error && (
              <p className="type-label-sm" style={{ color: 'var(--error)' }}>{error}</p>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="btn-action"
                style={{ width: '100%', padding: '16px', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}
              >
                {loading ? 'Creating account…' : 'Get Started'}
                {!loading && <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_forward</span>}
              </button>
            </div>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '-8px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
              <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)' }}>OR</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }} />
            </div>

            {/* Google button */}
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', filter: 'grayscale(100%)', marginTop: '-8px' }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google sign in failed.')}
                theme="outline"
                size="large"
                shape="rectangular"
                width="100%"
              />
            </div>

            <p className="type-label-sm" style={{ textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: '11px', letterSpacing: '0.02em', marginTop: '16px' }}>
              By registering, you agree to our{' '}
              <a href="#" style={{ color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>Terms of Service</a>
              {' '}and{' '}
              <a href="#" style={{ color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>Privacy Policy</a>.
            </p>
          </form>

          <div
            style={{
              marginTop: '48px',
              paddingTop: '32px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <span className="type-body-md" style={{ color: 'var(--on-surface-variant)' }}>Already have an account?</span>
            <a
              href="/login"
              onClick={(e) => { e.preventDefault(); navigate('/login'); }}
              className="type-button"
              style={{
                color: 'var(--primary)',
                textDecoration: 'none',
                borderBottom: '1px solid var(--primary)',
                paddingBottom: '2px',
                letterSpacing: '0.05em',
              }}
            >
              Sign In
            </a>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ padding: '32px 40px', background: 'var(--surface)', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <p className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px' }}>
            © 2024 Lakeside Enterprise
          </p>
          <div style={{ display: 'flex', gap: '24px' }}>
            {['Status', 'Privacy', 'Security'].map((l) => (
              <a key={l} href="#" className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textDecoration: 'none', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
};

const FloatingInput: React.FC<{
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
}> = ({ id, label, type, value, onChange }) => {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;

  return (
    <div style={{ position: 'relative', paddingTop: '20px' }}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder=" "
        required
        style={{
          display: 'block',
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: `1px solid ${focused ? 'var(--primary)' : 'var(--border-subtle)'}`,
          padding: '8px 0',
          fontFamily: 'var(--font-body)',
          fontSize: '16px',
          color: 'var(--on-surface)',
          outline: 'none',
        }}
      />
      <label
        htmlFor={id}
        className="type-label-sm"
        style={{
          position: 'absolute',
          left: 0,
          top: lifted ? '0px' : '28px',
          fontSize: lifted ? '10px' : '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: focused ? 'var(--primary)' : 'var(--on-surface-variant)',
          pointerEvents: 'none',
          transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {label}
      </label>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '2px',
          width: focused ? '100%' : '0%',
          background: 'var(--primary)',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
};

export default Signup;

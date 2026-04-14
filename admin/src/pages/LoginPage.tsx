import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { QrCode, AlertCircle, Info } from 'lucide-react';

export default function LoginPage() {
  const { signIn, register, firebaseConfigured } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === 'signin') {
        await signIn(normalizedEmail, password);
        navigate('/');
      } else {
        await register({
          email: normalizedEmail,
          password,
          displayName: name.trim() || normalizedEmail.split('@')[0],
          role: 'admin',
          companyName: companyName.trim(),
        });
        setInfo('Account created. You are now signed in.');
        navigate('/');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Authentication failed';
      if (msg.includes('user-not-found')) setError('No account found with this email.');
      else if (msg.includes('wrong-password')) setError('Incorrect password.');
      else if (msg.includes('invalid-email')) setError('Invalid email address.');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Ambient Glows */}
      <div style={{
        position: 'absolute', top: '15%', left: '15%', width: '40vw', height: '40vw',
        background: 'var(--color-primary)', filter: 'blur(140px)', opacity: 0.15,
        borderRadius: '50%', pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '15%', width: '30vw', height: '30vw',
        background: 'var(--color-secondary)', filter: 'blur(120px)', opacity: 0.15,
        borderRadius: '50%', pointerEvents: 'none'
      }} />

      <div className="card animate-in" style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 10, padding: 32 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div className="sidebar-logo" style={{
            width: 72, height: 72, margin: '0 auto 20px',
            borderRadius: 'var(--radius-xl)',
          }}>
            <QrCode size={36} color="white" />
          </div>
          <h1 className="page-title" style={{ fontSize: 26, marginBottom: 8, textAlign: 'center' }}>
            QR Task Manager
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {mode === 'signin' ? 'Sign in to your workspace' : 'Create your admin account'}
          </p>
        </div>

        {/* Firebase config check */}
        {!firebaseConfigured && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: 14, marginBottom: 20,
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-info)',
            fontSize: 13, lineHeight: 1.5,
          }}>
            <Info size={18} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Firebase not configured. Copy <code>.env.example</code> to <code>.env.local</code> and add your Firebase project credentials to enable authentication.</span>
          </div>
        )}

        {info && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: 14, marginBottom: 20,
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-info)',
            fontSize: 14,
          }}>
            <Info size={18} />
            {info}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: 14, marginBottom: 20,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-danger)',
            fontSize: 14,
          }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Company Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Your company name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="employee@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', padding: '14px 20px', marginTop: 8 }}
          >
            {loading
              ? 'Please wait...'
              : mode === 'signin'
              ? 'Sign In'
              : 'Sign Up'}
          </button>
        </form>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setError('');
            setInfo('');
            setMode((prev) => (prev === 'signin' ? 'signup' : 'signin'));
          }}
          style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', marginTop: 12 }}
        >
          {mode === 'signin' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
        </button>

        {mode === 'signup' && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setName('');
              setCompanyName('');
            }}
            style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', marginTop: 12 }}
          >
            Clear sign-up fields
          </button>
        )}

      </div>
    </div>
  );
}

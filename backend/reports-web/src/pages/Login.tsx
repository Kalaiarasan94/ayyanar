import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Eye, EyeOff, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { authApi } from '../api';
import { setSession } from '../auth';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await authApi.login(username.trim(), password.trim());
      if (!res.success || !res.user) {
        setError('Incorrect username or password.');
        return;
      }
      if (res.user.role !== 'Admin') {
        setError('This dashboard is for Admin accounts only.');
        return;
      }
      setSession({ id: res.user.id, username: res.user.username, name: res.user.name });
      navigate('/');
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-container">
        <form className="login-card" onSubmit={handleSubmit}>
          
          {/* Brand Emblem */}
          <div className="login-brand-header">
            <div className="login-icon-badge">
              <Building2 size={26} color="#E23744" />
            </div>
            <div className="login-portal-pill">
              <span className="login-pulse-dot" />
              <span>ADMIN ACCESS PORTAL</span>
            </div>
            <h1 className="login-title">Ayyanar Reports</h1>
            <p className="login-subtitle">Operations & Financial Analytics Suite</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          {/* Username Field */}
          <div className="login-field-group">
            <label className="login-field-label">USERNAME</label>
            <div className="login-input-wrap">
              <User className="login-input-icon" size={18} />
              <input
                className="login-input with-icon"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoFocus
                required
              />
            </div>
          </div>

          {/* Password Field with Eye Toggle */}
          <div className="login-field-group">
            <label className="login-field-label">PASSWORD</label>
            <div className="login-input-wrap">
              <Lock className="login-input-icon" size={18} />
              <input
                className="login-input with-icon with-eye"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? (
              <span>Authenticating…</span>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>

          <div className="login-footer-security">
            <ShieldCheck size={14} />
            <span>Authorized Personnel Only · 256-bit Encrypted Session</span>
          </div>
        </form>
      </div>
    </div>
  );
}

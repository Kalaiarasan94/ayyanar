import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { setSession } from '../auth';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">Ayyanar Reports</h1>
        <p className="login-subtitle">Admin-only analytics dashboard</p>

        {error && <div className="login-error">{error}</div>}

        <label className="login-field-label">USERNAME</label>
        <input
          className="login-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoFocus
        />

        <label className="login-field-label">PASSWORD</label>
        <input
          className="login-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="login-submit" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

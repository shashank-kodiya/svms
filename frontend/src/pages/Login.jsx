import { useState } from 'react';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth, homeFor } from '../context/AuthContext.jsx';
import { errorMessage } from '../api/client.js';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const u = await login(form.email, form.password);
      const from = location.state?.from?.pathname;
      navigate(from && from.startsWith(homeFor(u.role)) ? from : homeFor(u.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <div className="brand"><span className="brand-mark">SV</span><b>Smart Vehicle Service</b></div>
        <h1>Log in</h1>
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        {error && <div className="alert bad">{error}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        <p className="small muted">New here? <Link to="/register">Create an account</Link></p>
      </form>
    </div>
  );
}

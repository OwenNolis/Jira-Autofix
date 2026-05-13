import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AuthPage.css';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Vul alle velden in.'); return; }
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Inloggen mislukt. Controleer je gegevens.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Inloggen</h1>
        <p className="auth-sub">Welkom terug bij <span>PULSE PRE</span></p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="filter-label">E-mailadres</label>
            <input
              type="email"
              className="form-input"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="filter-label">Wachtwoord</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-primary btn-full auth-submit" disabled={loading}>
            {loading ? 'Even wachten...' : 'Inloggen'}
          </button>
        </form>

        <p className="auth-switch">
          Nog geen account? <Link to="/register">Registreren</Link>
        </p>
      </div>
    </div>
  );
}

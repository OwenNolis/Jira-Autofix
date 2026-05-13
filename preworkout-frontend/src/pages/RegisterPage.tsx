import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AuthPage.css';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      setError('Vul alle velden in.'); return;
    }
    if (form.password !== form.confirm) {
      setError('Wachtwoorden komen niet overeen.'); return;
    }
    if (form.password.length < 8) {
      setError('Wachtwoord moet minimaal 8 tekens bevatten.'); return;
    }
    setLoading(true);
    try {
      await register(form.firstName, form.lastName, form.email, form.password);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Registratie mislukt.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Registreren</h1>
        <p className="auth-sub">Maak een account aan bij <span>PULSE PRE</span></p>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-group">
              <label className="filter-label">Voornaam</label>
              <input name="firstName" className="form-input" placeholder="John" value={form.firstName} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="filter-label">Achternaam</label>
              <input name="lastName" className="form-input" placeholder="Doe" value={form.lastName} onChange={handleChange} />
            </div>
          </div>
          <div className="form-group">
            <label className="filter-label">E-mailadres</label>
            <input name="email" type="email" className="form-input" placeholder="john@example.com" value={form.email} onChange={handleChange} autoComplete="email" />
          </div>
          <div className="form-group">
            <label className="filter-label">Wachtwoord</label>
            <input name="password" type="password" className="form-input" placeholder="Min. 8 tekens" value={form.password} onChange={handleChange} autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label className="filter-label">Wachtwoord bevestigen</label>
            <input name="confirm" type="password" className="form-input" placeholder="Herhaal wachtwoord" value={form.confirm} onChange={handleChange} autoComplete="new-password" />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-primary btn-full auth-submit" disabled={loading}>
            {loading ? 'Even wachten...' : 'Account aanmaken'}
          </button>
        </form>

        <p className="auth-switch">
          Al een account? <Link to="/login">Inloggen</Link>
        </p>
      </div>
    </div>
  );
}

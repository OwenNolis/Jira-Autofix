import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './AccountPage.css';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
  });
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="account-login-prompt">
        <h2>Log in om je account te bekijken</h2>
        <button className="btn-primary" onClick={() => navigate('/login')}>
          Inloggen
        </button>
      </div>
    );
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    // Demo: update local storage copy of user
    const updated = { ...user, firstName: form.firstName, lastName: form.lastName, email: form.email };
    localStorage.setItem('user', JSON.stringify(updated));
    setEditMode(false);
    setSavedMessage('Profiel bijgewerkt (demo — niet persistent).');
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <div className="account-page">
      <div className="account-container">
        <h1 className="account-title">Mijn Account</h1>

        <div className="account-card">
          <div className="account-avatar">
            {user.firstName.charAt(0).toUpperCase()}
            {user.lastName.charAt(0).toUpperCase()}
          </div>

          <div className="account-info">
            <h2 className="account-name">
              {user.firstName} {user.lastName}
            </h2>
            <span className="account-role">{user.role ?? 'Customer'}</span>
          </div>
        </div>

        <div className="account-section">
          <div className="account-section-header">
            <h3>Persoonlijke gegevens</h3>
            {!editMode && (
              <button className="btn-edit" onClick={() => { setEditMode(true); setSavedMessage(null); }}>
                Bewerken
              </button>
            )}
          </div>

          {!editMode ? (
            <dl className="account-details">
              <div className="account-detail-row">
                <dt>Voornaam</dt>
                <dd>{user.firstName}</dd>
              </div>
              <div className="account-detail-row">
                <dt>Achternaam</dt>
                <dd>{user.lastName}</dd>
              </div>
              <div className="account-detail-row">
                <dt>E-mailadres</dt>
                <dd>{user.email}</dd>
              </div>
              <div className="account-detail-row">
                <dt>Rol</dt>
                <dd>{user.role ?? 'Customer'}</dd>
              </div>
            </dl>
          ) : (
            <form className="account-form" onSubmit={handleSave}>
              <div className="account-form-group">
                <label htmlFor="firstName">Voornaam</label>
                <input
                  id="firstName"
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="account-form-group">
                <label htmlFor="lastName">Achternaam</label>
                <input
                  id="lastName"
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="account-form-group">
                <label htmlFor="email">E-mailadres</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="account-form-actions">
                <button type="submit" className="btn-primary">Opslaan</button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setEditMode(false); setForm({ firstName: user.firstName, lastName: user.lastName, email: user.email }); }}
                >
                  Annuleren
                </button>
              </div>
            </form>
          )}

          {savedMessage && <p className="account-saved-msg">{savedMessage}</p>}
        </div>

        <div className="account-section">
          <div className="account-section-header">
            <h3>Bestellingen</h3>
          </div>
          <p className="account-section-desc">
            Bekijk en beheer al je bestellingen.
          </p>
          <button className="btn-secondary" onClick={() => navigate('/orders')}>
            Naar mijn bestellingen
          </button>
        </div>

        <div className="account-logout">
          <button className="btn-logout" onClick={handleLogout}>
            Uitloggen
          </button>
        </div>
      </div>
    </div>
  );
}

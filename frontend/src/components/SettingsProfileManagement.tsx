import React, { useState } from 'react';
import './Settings.css';

function SaveIcon() {
  return (
    <svg className="save-icon" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="14" height="14" rx="3" fill="currentColor" opacity="0.13"/>
      <path d="M6 10.5L9 13.5L14 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ProfileManagement() {
  // Demo: hardcoded user info, editable
  const [profile, setProfile] = useState({
    name: 'Admin User',
    username: 'admin',
    email: 'admin@example.com',
    role: 'Administrator',
    bio: 'Welcome to your profile page! This is a demo user for Jira Autofix.'
  });
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(profile);
  const [message, setMessage] = useState<string | null>(null);

  const handleEdit = () => {
    setForm(profile);
    setEditMode(true);
    setMessage(null);
  };
  const handleCancel = () => {
    setEditMode(false);
    setMessage(null);
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setProfile(form);
    setEditMode(false);
    setMessage('Profile updated (demo only, not persisted).');
  };

  return (
    <section className="settings-section" style={{ marginTop: 0 }}>
      <h2>Profile Management</h2>
      {!editMode ? (
        <div style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto' }}>
          <div style={{ marginBottom: 10 }}><strong>Name:</strong> {profile.name}</div>
          <div style={{ marginBottom: 10 }}><strong>Username:</strong> {profile.username}</div>
          <div style={{ marginBottom: 10 }}><strong>Email:</strong> {profile.email}</div>
          <div style={{ marginBottom: 10 }}><strong>Role:</strong> {profile.role}</div>
          <div style={{ marginBottom: 10 }}><strong>Bio:</strong> <span style={{ whiteSpace: 'pre-line' }}>{profile.bio}</span></div>
          <button
            type="button"
            style={{
              marginTop: 12,
              padding: '8px 22px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--color-button-bg)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '1.05rem',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onClick={handleEdit}
          >Edit Profile</button>
          {message && <div style={{ color: '#4caf50', marginTop: 10 }}>{message}</div>}
        </div>
      ) : (
        <form onSubmit={handleSave} style={{ maxWidth: 400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label>
            Name
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #ccc', marginTop: 4 }}
              required
            />
          </label>
          <label>
            Username
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #ccc', marginTop: 4 }}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #ccc', marginTop: 4 }}
              required
            />
          </label>
          <label>
            Role
            <input
              type="text"
              name="role"
              value={form.role}
              onChange={handleChange}
              style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #ccc', marginTop: 4 }}
              required
            />
          </label>
          <label>
            Bio
            <textarea
              name="bio"
              value={form.bio}
              onChange={handleChange}
              style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid #ccc', marginTop: 4, minHeight: 60 }}
            />
          </label>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="submit"
              className="primary-save-btn"
              style={{
                // Remove background, color, etc. to use .primary-save-btn
                // Only add margin if needed
              }}
            >
              <SaveIcon />
              Save Changes
            </button>
            <button
              type="button"
              style={{
                padding: '8px 22px',
                borderRadius: 6,
                border: 'none',
                background: '#bdbdbd',
                color: '#fff',
                fontWeight: 600,
                fontSize: '1.05rem',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onClick={handleCancel}
            >Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}

export default ProfileManagement;

import React from 'react';
import './Settings.css';
import ProfileManagement from './SettingsProfileManagement';

function Settings() {
  const [activeTab, setActiveTab] = React.useState<'main' | 'profile'>('main');

  return (
    <div className="settings-page">
      <div className="settings-card">
        <h1 className="settings-header">Settings</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginBottom: 24 }}>
          <button
            type="button"
            className={`settings-tab-btn${activeTab === 'main' ? ' active' : ''}`}
            onClick={() => setActiveTab('main')}
            style={{
              padding: '10px 22px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'main' ? 'var(--color-nav)' : 'var(--color-card-bg)',
              color: activeTab === 'main' ? '#fff' : 'var(--color-text)',
              fontWeight: 600,
              fontSize: '1.08rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'main' ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
              transition: 'background 0.2s, color 0.2s',
            }}
            aria-current={activeTab === 'main' ? 'page' : undefined}
          >
            General
          </button>
          <button
            type="button"
            className={`settings-tab-btn${activeTab === 'profile' ? ' active' : ''}`}
            onClick={() => setActiveTab('profile')}
            style={{
              padding: '10px 22px',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'profile' ? 'var(--color-nav)' : 'var(--color-card-bg)',
              color: activeTab === 'profile' ? '#fff' : 'var(--color-text)',
              fontWeight: 600,
              fontSize: '1.08rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'profile' ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
              transition: 'background 0.2s, color 0.2s',
            }}
            aria-current={activeTab === 'profile' ? 'page' : undefined}
          >
            Profile Management
          </button>
        </div>
        {activeTab === 'main' && (
          <>
            <p className="settings-desc">This is the Settings page. Here you can manage your preferences and application settings. (Demo placeholder)</p>
            <section className="settings-section">
              <h2>Preferences</h2>
              <ul className="settings-list">
                <li>Dark mode toggle is available in the navbar.</li>
                <li>Profile management is available in the tab above.</li>
                <li>Notification settings coming soon.</li>
              </ul>
            </section>
          </>
        )}
        {activeTab === 'profile' && <ProfileManagement />}
      </div>
    </div>
  );
}

export default Settings;

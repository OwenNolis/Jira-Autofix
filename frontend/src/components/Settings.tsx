import React from 'react';
import './Settings.css';

function Settings() {
  return (
    <div className="settings-page">
      <div className="settings-card">
        <h1 className="settings-header">Settings</h1>
        <p className="settings-desc">This is the Settings page. Here you can manage your preferences and application settings. (Demo placeholder)</p>
        <section className="settings-section">
          <h2>Preferences</h2>
          <ul className="settings-list">
            <li>Dark mode toggle is available in the navbar.</li>
            <li>Profile management coming soon.</li>
            <li>Notification settings coming soon.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}

export default Settings;

import React from 'react';

function Notifications() {
  // Demo placeholder: static notifications
  const notifications = [
    {
      id: 1,
      title: 'Welcome to Notifications!',
      message: 'This is your notifications page. Here you will see important updates and alerts.',
      date: new Date().toLocaleString(),
      read: false,
    },
    {
      id: 2,
      title: 'Jira Issue Synced',
      message: 'Jira issue JIRAFIX-53 was synced to GitHub.',
      date: new Date(Date.now() - 3600 * 1000).toLocaleString(),
      read: true,
    },
    {
      id: 3,
      title: 'AI Fix PR Created',
      message: 'A pull request was auto-created for JIRAFIX-53.',
      date: new Date(Date.now() - 2 * 3600 * 1000).toLocaleString(),
      read: true,
    },
  ];

  return (
    <div className="notifications-page" style={{
      background: 'var(--color-card-bg)',
      borderRadius: 12,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      margin: '32px auto',
      maxWidth: 700,
      padding: '40px 20px',
      transition: 'background 0.2s, box-shadow 0.2s',
    }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-nav)', marginBottom: '0.5em', letterSpacing: '-1px' }}>Notifications</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {notifications.map((n) => (
          <div key={n.id} style={{
            background: n.read ? '#f8fafc' : '#e3f2fd',
            borderRadius: 8,
            border: '1px solid #e0e4ea',
            padding: '18px 16px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
            marginBottom: 0,
            opacity: n.read ? 0.7 : 1,
            transition: 'background 0.2s, opacity 0.2s',
          }}>
            <div style={{ fontWeight: 600, fontSize: '1.13rem', color: 'var(--color-nav)', marginBottom: 6 }}>{n.title}</div>
            <div style={{ fontSize: '1.05rem', color: 'var(--color-text)', marginBottom: 8 }}>{n.message}</div>
            <div style={{ fontSize: '0.98rem', color: '#888', textAlign: 'right' }}>{n.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Notifications;

import React, { useState } from 'react';

interface Notification {
  id: number;
  title: string;
  message: string;
  date: string;
  read: boolean;
}

function Notifications() {
  // Demo placeholder: static notifications
  const [notifications, setNotifications] = useState<Notification[]>([
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
  ]);

  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const handleAddNotification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newMessage.trim()) {
      setFormError('Title and message are required.');
      return;
    }
    const newNotification: Notification = {
      id: notifications.length > 0 ? Math.max(...notifications.map(n => n.id)) + 1 : 1,
      title: newTitle,
      message: newMessage,
      date: new Date().toLocaleString(),
      read: false,
    };
    setNotifications([newNotification, ...notifications]);
    setNewTitle('');
    setNewMessage('');
    setFormError(null);
  };

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
      <form onSubmit={handleAddNotification} style={{
        marginBottom: 28,
        background: '#f8fafc',
        borderRadius: 8,
        border: '1px solid #e0e4ea',
        padding: '18px 16px 14px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: 500,
      }}>
        <div style={{ fontWeight: 600, fontSize: '1.13rem', color: 'var(--color-nav)', marginBottom: 2 }}>Add New Notification</div>
        <input
          type="text"
          placeholder="Title"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          style={{
            padding: '10px',
            borderRadius: 6,
            border: '1px solid #ccc',
            fontSize: '1rem',
            marginBottom: 0,
          }}
          aria-label="Notification title"
        />
        <textarea
          placeholder="Message"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          style={{
            padding: '10px',
            borderRadius: 6,
            border: '1px solid #ccc',
            fontSize: '1rem',
            minHeight: 60,
            marginBottom: 0,
            resize: 'vertical',
          }}
          aria-label="Notification message"
        />
        {formError && <div style={{ color: '#d32f2f', fontSize: '0.98rem', marginBottom: 0 }}>{formError}</div>}
        <button
          type="submit"
          style={{
            alignSelf: 'flex-end',
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
        >Add Notification</button>
      </form>
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

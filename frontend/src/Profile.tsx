import React from 'react';
import './Profile.css';

function Profile() {
  // For demo, use hardcoded user info
  const user = {
    name: 'Admin User',
    username: 'admin',
    email: 'admin@example.com',
    avatar: '/Hessi.png',
    role: 'Administrator',
    bio: 'Welcome to your profile page! This is a demo user for Jira Autofix.'
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <img src={user.avatar} alt="User Avatar" className="profile-avatar" />
        <h1 className="profile-name">{user.name}</h1>
        <div className="profile-username">@{user.username}</div>
        <div className="profile-role">{user.role}</div>
        <div className="profile-email">{user.email}</div>
        <p className="profile-bio">{user.bio}</p>
      </div>
    </div>
  );
}

export default Profile;

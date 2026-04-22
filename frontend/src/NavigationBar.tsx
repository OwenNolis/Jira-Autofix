import React from 'react';
import { Link } from 'react-router-dom';
import './NavigationBar.css';

interface NavigationBarProps {
  isAuthenticated: boolean;
}

function NavigationBar({ isAuthenticated }: NavigationBarProps) {
  return (
    <nav className="navigation-bar">
      <div className="nav-logo">Jira Autofix</div>
      <ul className="nav-links">
        {isAuthenticated ? (
          <>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About</Link></li>
          </>
        ) : (
          <li><Link to="/login">Login</Link></li>
        )}
      </ul>
    </nav>
  );
}

export default NavigationBar;

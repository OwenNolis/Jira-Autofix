import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import './App.css';
import About from './About';
import Login from './Login';
import Profile from './Profile';
import EssersMap from './components/EssersMap';
import PipelineRunDashboard from './components/PipelineRunDashboard';
import IssuesPage from './components/IssuesPage';
import Settings from './components/Settings';

// Sun and Moon SVG icons
const SunIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2"/>
  </svg>
);
const MoonIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 12.79A9 9 0 0111.21 3c0 .34.02.68.05 1.01A7 7 0 1012 21a9 9 0 009-8.21z" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
);

interface NavigationBarProps {
  isDarkMode: boolean;
  handleToggleDarkMode: () => void;
  isAuthenticated: boolean;
  handleLogout: () => void;
  isAvatarMenuOpen: boolean;
  toggleAvatarMenu: () => void;
  avatarMenuRef: React.RefObject<HTMLDivElement | null>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}

// Navigation bar extracted as a component for clarity and reusability
function NavigationBar({ isDarkMode, handleToggleDarkMode, isAuthenticated, handleLogout, isAvatarMenuOpen, toggleAvatarMenu, avatarMenuRef, audioRef }: NavigationBarProps) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navigation-bar">
      <ul className="nav-links">
        <li><Link to="/" className={isActive('/') ? 'active' : ''}>Home</Link></li>
        <li><Link to="/map" className={isActive('/map') ? 'active' : ''}>Map</Link></li>
        <li><Link to="/issues" className={isActive('/issues') ? 'active' : ''}>Issues</Link></li>
        <li><Link to="/about" className={isActive('/about') ? 'active' : ''}>About</Link></li>
        <li><Link to="/profile" className={isActive('/profile') ? 'active' : ''}>Profile</Link></li>
        <li><Link to="/settings" className={isActive('/settings') ? 'active' : ''}>Settings</Link></li>
      </ul>
      <div className="nav-actions">
        {/* Dark mode toggle button */}
        <button
          className="dark-mode-toggle"
          onClick={handleToggleDarkMode}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          type="button"
        >
          {isDarkMode ? <SunIcon /> : <MoonIcon />}
        </button>
        {isAuthenticated && (
          <div className="avatar-menu" ref={avatarMenuRef}>
            <img
              src="/Hessi.png"
              alt="User Avatar"
              className="avatar"
              onClick={toggleAvatarMenu}
            />
            {/* Use local horn.mp3 instead of remote sound */}
            <audio ref={audioRef} src="/horn.mp3" preload="auto" />
            {isAvatarMenuOpen && (
              <div className="dropdown-menu">
                <button onClick={handleLogout}>Logout</button>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

// Inner component — rendered inside <Router> so useNavigate is valid here
function AppContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);

  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Apply dark mode class to root div
  useEffect(() => {
    // This effect is for body-level styling if needed
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    alert('You have been logged out.');
    navigate('/login');
  };

  const playHornSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  const toggleAvatarMenu = () => {
    playHornSound();
    setIsAvatarMenuOpen((prev) => !prev);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
      setIsAvatarMenuOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Dark mode toggle handler
  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => {
      localStorage.setItem('darkMode', String(!prev));
      return !prev;
    });
  };

  return (
    <div className={`App${isDarkMode ? ' dark' : ''}`}>
      <NavigationBar
        isDarkMode={isDarkMode}
        handleToggleDarkMode={handleToggleDarkMode}
        isAuthenticated={isAuthenticated}
        handleLogout={handleLogout}
        isAvatarMenuOpen={isAvatarMenuOpen}
        toggleAvatarMenu={toggleAvatarMenu}
        avatarMenuRef={avatarMenuRef}
        audioRef={audioRef}
      />
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" /> : <Login onLogin={() => setIsAuthenticated(true)} />}
        />
        <Route
          path="/about"
          element={isAuthenticated ? <About /> : <Navigate to="/login" />}
        />
        <Route
          path="/map"
          element={isAuthenticated ? <EssersMap /> : <Navigate to="/login" />}
        />
        <Route
          path="/issues"
          element={isAuthenticated ? <IssuesPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/profile"
          element={isAuthenticated ? <Profile /> : <Navigate to="/login" />}
        />
        <Route
          path="/settings"
          element={isAuthenticated ? <Settings /> : <Navigate to="/login" />}
        />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <div className="home-page">
                <h1>Welcome to Jira Autofix</h1>
                <p>Streamline your development process with AI-powered fixes.</p>
                <PipelineRunDashboard />
              </div>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </div>
  );
}

// Outer shell — only responsible for providing the Router context
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

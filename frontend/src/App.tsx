import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import './App.css';
import About from './About';
import Login from './Login';

// New Map page component
function Map() {
  return (
    <div className="map-page">
      <h1>Map</h1>
      <p>This is the Map page. Here you can view the project map or related visualizations.</p>
    </div>
  );
}

type RunHistoryEntry = {
  timestamp: string;
  status: string;
};

function App() {
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

  return (
    <Router>
      <div className="App">
        <nav className="navigation-bar">
          <ul className="nav-links">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About</Link></li>
            <li><Link to="/map">Map</Link></li>
          </ul>
          {isAuthenticated && (
            <div className="avatar-menu" ref={avatarMenuRef}>
              <img
                src="/Hessi.png"
                alt="User Avatar"
                className="avatar"
                onClick={toggleAvatarMenu}
              />
              <audio ref={audioRef} src="https://cdn.pixabay.com/audio/2022/07/26/audio_124bfae7b2.mp3" preload="auto" />
              {isAvatarMenuOpen && (
                <div className="dropdown-menu">
                  <button onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          )}
        </nav>
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" /> : <Login onLogin={() => setIsAuthenticated(true)} />}
          />
          <Route
            path="/about"
            element={
              isAuthenticated ? (
                <About />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/map"
            element={
              isAuthenticated ? (
                <Map />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <div className="home-page">
                  <h1>Welcome to Jira Autofix</h1>
                  <p>Streamline your development process with AI-powered fixes.</p>
                </div>
              ) : (
                <Navigate to="/login" />
              )
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

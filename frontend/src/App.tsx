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
import Notifications from './components/Notifications';

// --- Toast Notification System ---
interface Toast {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number; // ms
}

const ToastContext = React.createContext<{
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
} | undefined>(undefined);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const showToast = (message: string, type: Toast['type'] = 'info', duration = 3500) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  };

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast-${toast.type}`}
            role="alert"
            tabIndex={0}
            onClick={() => removeToast(toast.id)}
          >
            {toast.message}
            <button className="toast-close" aria-label="Close" onClick={() => removeToast(toast.id)}>&times;</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// --- ColorPalette component ---
const COLOR_PALETTE = [
  { name: 'Blue', value: '#007bff' },
  { name: 'Green', value: '#4caf50' },
  { name: 'Orange', value: '#ff9800' },
  { name: 'Purple', value: '#8e24aa' },
  { name: 'Red', value: '#e53935' },
  { name: 'Teal', value: '#00897b' },
  { name: 'Gray', value: '#23272f' },
];

function ColorPalette({ currentColor, onChange }: { currentColor: string; onChange: (color: string) => void }) {
  return (
    <div className="color-palette-navbar" title="Change navbar color">
      {COLOR_PALETTE.map((c) => (
        <button
          key={c.value}
          className={`color-palette-swatch${currentColor === c.value ? ' selected' : ''}`}
          style={{ background: c.value }}
          aria-label={c.name}
          onClick={() => onChange(c.value)}
          type="button"
        />
      ))}
    </div>
  );
}

// --- ClockWidget component ---
function ClockWidget() {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="navbar-clock-widget" title="Current time" aria-label="Current time">
      {time}
    </div>
  );
}

// --- CookieConsentPopup component ---
function CookieConsentPopup({ open, onAccept }: { open: boolean; onAccept: () => void }) {
  if (!open) return null;
  return (
    <div className="cookie-popup-overlay">
      <div className="cookie-popup">
        <div className="cookie-popup-title">Cookie Consent</div>
        <div className="cookie-popup-message">
          This site uses cookies to enhance your experience. By continuing to use the application, you agree to our use of cookies.
        </div>
        <button className="cookie-popup-btn" onClick={onAccept} autoFocus>Accept</button>
      </div>
    </div>
  );
}

// Sun and Moon SVG icons
const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2"/>
  </svg>
);
const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
  navColor: string;
  setNavColor: (color: string) => void;
}

// Navigation bar extracted as a component for clarity and reusability
function NavigationBar({ isDarkMode, handleToggleDarkMode, isAuthenticated, handleLogout, isAvatarMenuOpen, toggleAvatarMenu, avatarMenuRef, audioRef, navColor, setNavColor }: NavigationBarProps) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="navigation-bar" style={{ backgroundColor: navColor }}>
      <ul className="nav-links">
        <li><Link to="/" className={isActive('/') ? 'active' : ''}>Home</Link></li>
        <li><Link to="/map" className={isActive('/map') ? 'active' : ''}>Map</Link></li>
        <li><Link to="/issues" className={isActive('/issues') ? 'active' : ''}>Issues</Link></li>
        <li><Link to="/notifications" className={isActive('/notifications') ? 'active' : ''}>Notifications</Link></li>
        <li><Link to="/about" className={isActive('/about') ? 'active' : ''}>About</Link></li>
        <li><Link to="/profile" className={isActive('/profile') ? 'active' : ''}>Profile</Link></li>
        <li><Link to="/settings" className={isActive('/settings') ? 'active' : ''}>Settings</Link></li>
      </ul>
      <div className="nav-actions">
        {/* Clock widget */}
        <ClockWidget />
        {/* Color palette for navbar color */}
        <ColorPalette currentColor={navColor} onChange={setNavColor} />
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
  const [showCookiePopup, setShowCookiePopup] = useState(() => {
    return isAuthenticated && localStorage.getItem('cookieConsent') !== 'true';
  });
  const [navColor, setNavColorState] = useState(() => {
    return localStorage.getItem('navColor') || '#007bff';
  });

  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Toast context
  const { showToast } = useToast();

  // Apply dark mode class to root div
  useEffect(() => {
    // This effect is for body-level styling if needed
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Show cookie popup after login if not already accepted
  useEffect(() => {
    if (isAuthenticated && localStorage.getItem('cookieConsent') !== 'true') {
      setShowCookiePopup(true);
    } else {
      setShowCookiePopup(false);
    }
  }, [isAuthenticated]);

  // Update nav color CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--color-nav', navColor);
  }, [navColor]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    showToast('You have been logged out.', 'info');
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
      showToast(`Switched to ${!prev ? 'dark' : 'light'} mode.`, 'info');
      return !prev;
    });
  };

  const handleAcceptCookies = () => {
    localStorage.setItem('cookieConsent', 'true');
    setShowCookiePopup(false);
    showToast('Cookie consent accepted.', 'success');
  };

  const setNavColor = (color: string) => {
    setNavColorState(color);
    localStorage.setItem('navColor', color);
    document.documentElement.style.setProperty('--color-nav', color);
    showToast('Navbar color updated.', 'info');
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
        navColor={navColor}
        setNavColor={setNavColor}
      />
      <CookieConsentPopup open={showCookiePopup} onAccept={handleAcceptCookies} />
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" /> : <Login onLogin={() => {
            setIsAuthenticated(true);
            showToast('Login successful!', 'success');
          }} />}
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
          path="/notifications"
          element={isAuthenticated ? <Notifications /> : <Navigate to="/login" />}
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
    <ToastProvider>
      <Router>
        <AppContent />
      </Router>
    </ToastProvider>
  );
}

export default App;

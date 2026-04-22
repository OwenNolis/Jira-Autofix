import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, Link } from 'react-router-dom';
import './App.css';
import About from './About';
import Login from './Login';

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
  const [warningVisible, setWarningVisible] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const hasStarted = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Run History State
  const [runHistory, setRunHistory] = useState<RunHistoryEntry[]>(() => {
    const savedHistory = localStorage.getItem('runHistory');
    return savedHistory ? JSON.parse(savedHistory) : [];
  });
  const [isHistoryVisible, setIsHistoryVisible] = useState(() => {
    const savedVisibility = localStorage.getItem('isHistoryVisible');
    return savedVisibility === 'true' || false; // Ensure default is false
  });

  const [isPopupVisible, setIsPopupVisible] = useState(false);

  const handlePopupOpen = () => {
    setIsPopupVisible(true);
  };

  const handlePopupClose = () => {
    setIsPopupVisible(false);
  };

  const handleRunAIFix = () => {
    setIsLoading(true);
    const newEntry: RunHistoryEntry = {
      timestamp: new Date().toISOString(),
      status: 'Triggered'
    };
    const updatedHistory = [newEntry, ...runHistory].slice(0, 5);
    setRunHistory(updatedHistory);
    localStorage.setItem('runHistory', JSON.stringify(updatedHistory));
    setTimeout(() => {
      alert('AI Fix triggered!');
      setIsLoading(false);
    }, 2000);
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear the run history?')) {
      setRunHistory([]);
      localStorage.removeItem('runHistory');
      localStorage.removeItem('isHistoryVisible');
      setIsHistoryVisible(false); // Explicitly hide the panel after clearing
    }
  };

  const toggleHistoryVisibility = () => {
    const newVisibility = !isHistoryVisible;
    setIsHistoryVisible(newVisibility);
    localStorage.setItem('isHistoryVisible', newVisibility.toString());
  };

  const startCountdown = () => {
    let timeLeft = 30;
    setCountdown(timeLeft);
    countdownIntervalRef.current = setInterval(() => {
      timeLeft -= 1;
      setCountdown(timeLeft);
      if (timeLeft <= 0) {
        clearInterval(countdownIntervalRef.current!);
      }
    }, 1000);
  };

  const resetTimeout = () => {
    if (timeoutRef.current)        clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    setWarningVisible(false);
    setCountdown(30);

    warningTimeoutRef.current = setTimeout(() => {
      setWarningVisible(true);
      startCountdown();
    }, 90 * 1000); // show warning 30s before logout

    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, 120 * 1000); // logout after 2 minutes
  };

  const resetTimeoutRef = useRef(resetTimeout);
  useEffect(() => { resetTimeoutRef.current = resetTimeout; });

  useEffect(() => {
    const handleActivity = () => {
      setWarningVisible(false);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      resetTimeoutRef.current();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      if (timeoutRef.current)           clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current)    clearTimeout(warningTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    document.title = 'Jira Autofix';
    return () => { document.title = 'Jira Autofix'; };
  }, []);

  useEffect(() => {
    if (!hasStarted.current) { hasStarted.current = true; return; }
    document.title = isLoading ? 'Processing... | Jira Autofix' : 'Fix Complete | Jira Autofix';
  }, [isLoading]);

  useEffect(() => {
    document.body.className = isDarkMode ? 'dark-mode' : '';
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('isAuthenticated', 'true');
    resetTimeout();
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    if (timeoutRef.current)           clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current)    clearTimeout(warningTimeoutRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  const RequireAuth = ({ children }: { children: React.ReactElement }) => {
    const location = useLocation();
    if (!isAuthenticated) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return children;
  };

  return (
    <Router>
      <div className="App">
        <nav className="navigation-bar">
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><button className="popup-button" onClick={handlePopupOpen}>Image Popup</button></li>
            <li><Link to="/about">About</Link></li>
          </ul>
          {isAuthenticated && (
            <button className="logout-button" onClick={handleLogout}>Logout</button>
          )}
        </nav>
        {isPopupVisible && (
          <div className="popup-overlay" onClick={handlePopupClose}>
            <div className="popup-content" onClick={(e) => e.stopPropagation()}>
              <img src="/BLU.jpg" alt="Popup" className="popup-image" />
              <button className="popup-close-button" onClick={handlePopupClose}>Close</button>
            </div>
          </div>
        )}
        {warningVisible && (
          <div className="session-warning">
            You will be logged out in <strong>{countdown}</strong> seconds due to inactivity.
          </div>
        )}
        <Routes>
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/" /> : <Login onLogin={handleLogin} />}
          />
          <Route
            path="/about"
            element={
              <RequireAuth>
                <About />
              </RequireAuth>
            }
          />
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <div>
                  <div className="card">
                    <h1>Jira Autofix</h1>
                    <p>Trigger an AI-powered fix for your Jira issues.</p>
                    <button
                      className="order-button"
                      onClick={handleRunAIFix}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Processing...' : 'Run AI Fix'}
                    </button>
                    {isLoading && <div className="spinner"></div>}
                    <div className="dark-mode-toggle">
                      <label>
                        <input
                          type="checkbox"
                          checked={isDarkMode}
                          onChange={toggleDarkMode}
                        />
                        Enable Dark Mode
                      </label>
                    </div>
                    <button
                      className="order-button"
                      onClick={toggleHistoryVisibility}
                    >
                      {isHistoryVisible ? 'Hide History' : 'Show History'}
                    </button>
                    {isHistoryVisible && (
                      <div className="card">
                        <h3>Run History</h3>
                        <ul>
                          {runHistory.map((entry: RunHistoryEntry, index: number) => (
                            <li key={index}>
                              {new Date(entry.timestamp).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })} - {entry.status}
                            </li>
                          ))}
                        </ul>
                        <button onClick={handleClearHistory} className="order-button">
                          Clear History
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="home-page">
                  <h1>Welcome to Jira Autofix</h1>
                  <p>Streamline your development process with AI-powered fixes.</p>
                </div>
              )
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

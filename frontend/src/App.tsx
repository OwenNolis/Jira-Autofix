import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import About from './About';
import Login from './Login';

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

  // ── Session timeout ──────────────────────────────────────────
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

  // Activity listeners — use a ref so resetTimeout is always current
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
  }, []); // run once on mount only — no warningVisible dependency

  // ── Tab title ────────────────────────────────────────────────
  useEffect(() => {
    document.title = 'Jira Autofix';
    return () => { document.title = 'Jira Autofix'; };
  }, []);

  useEffect(() => {
    if (!hasStarted.current) { hasStarted.current = true; return; }
    document.title = isLoading ? 'Processing... | Jira Autofix' : 'Fix Complete | Jira Autofix';
  }, [isLoading]);

  // ── Dark mode ────────────────────────────────────────────────
  useEffect(() => {
    document.body.className = isDarkMode ? 'dark-mode' : '';
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleRunAIFix = () => {
    setIsLoading(true);
    setTimeout(() => {
      alert('AI Fix triggered!');
      setIsLoading(false);
    }, 2000);
  };

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

  // ── Protected route helper ───────────────────────────────────
  const RequireAuth = ({ children }: { children: React.ReactElement }) => {
    const location = useLocation();
    if (!isAuthenticated) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return children;
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <Router>
      <div className="App">
        {warningVisible && (
          <div className="session-warning">
            You will be logged out in <strong>{countdown}</strong> seconds due to inactivity.
          </div>
        )}
        {isAuthenticated && (
          <nav>
            <ul>
              <li><a href="/">Home</a></li>
              <li><a href="/about">About</a></li>
              <li><button onClick={handleLogout}>Logout</button></li>
            </ul>
          </nav>
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
                  </div>
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

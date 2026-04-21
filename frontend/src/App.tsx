import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import './App.css';
import About from './About';
import Login from './Login';
import RunHistory from './RunHistory';

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

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.setItem('isAuthenticated', 'false');
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

  // ── Run History ─────────────────────────────────────────────
  const [runHistoryVisible, setRunHistoryVisible] = useState(() => {
    return localStorage.getItem('runHistoryVisible') === 'true';
  });

  const handleRunFix = () => {
    const history = JSON.parse(localStorage.getItem('runHistory') || '[]');
    const newEntry = { timestamp: new Date().toISOString(), status: 'Triggered' };
    const updatedHistory = [newEntry, ...history].slice(0, 5);
    localStorage.setItem('runHistory', JSON.stringify(updatedHistory));
  };

  const clearRunHistory = () => {
    localStorage.removeItem('runHistory');
    setRunHistoryVisible(false);
  };

  useEffect(() => {
    localStorage.setItem('runHistoryVisible', runHistoryVisible.toString());
  }, [runHistoryVisible]);

  return (
    <Router>
      <div className={`App ${isDarkMode ? 'dark-mode' : ''}`}>
        <header className="App-header">
          <button onClick={handleRunFix} className="order-button">Run AI Fix</button>
          <button onClick={() => setRunHistoryVisible(!runHistoryVisible)} className="order-button">
            {runHistoryVisible ? 'Hide History' : 'Show History'}
          </button>
        </header>
        {runHistoryVisible && (
          <RunHistory onClear={clearRunHistory} />
        )}
        <Routes>
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login onLogin={() => setIsAuthenticated(true)} />} />
          <Route path="/" element={isAuthenticated ? <Navigate to="/about" /> : <Navigate to="/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

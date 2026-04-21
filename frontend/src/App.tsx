import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    alert('You have been logged out due to inactivity.');
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
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
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

  useEffect(() => {
    const handleActivity = () => {
      if (warningVisible) {
        setWarningVisible(false);
      }
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      resetTimeout();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);

    resetTimeout();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [warningVisible]);

  return (
    <Router>
      <div className={`App ${isDarkMode ? 'dark-mode' : ''}`}>
        {warningVisible && (
          <div className="session-warning">
            You will be logged out in <strong>{countdown}</strong> seconds due to inactivity.
          </div>
        )}
        <Routes>
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Navigate to="/about" replace />
              ) : (
                <Login onLogin={() => {
                  setIsAuthenticated(true);
                  localStorage.setItem('isAuthenticated', 'true');
                  resetTimeout();
                }} />
              )
            }
          />
          <Route path="/about" element={<About />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

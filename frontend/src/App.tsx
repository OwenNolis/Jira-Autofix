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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    setWarningVisible(false);

    warningTimeoutRef.current = setTimeout(() => {
      setWarningVisible(true);
    }, 90 * 1000); // Show warning after 90 seconds

    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, 120 * 1000); // Logout after 120 seconds
  };

  useEffect(() => {
    const handleActivity = () => {
      if (warningVisible) {
        setWarningVisible(false);
      }
      resetTimeout();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keypress', handleActivity);

    resetTimeout();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [warningVisible]);

  useEffect(() => {
    document.body.className = isDarkMode ? 'dark-mode' : '';
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  const handleRunAIFix = () => {
    setIsLoading(true);
    setTimeout(() => {
      alert('AI Fix triggered!');
      setIsLoading(false);
    }, 2000);
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prevMode) => !prevMode);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('isAuthenticated', 'true');
    resetTimeout();
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    localStorage.clear(); // Explicitly clear localStorage
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
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
        {warningVisible && (
          <div className="warning">You will be logged out in 30 seconds due to inactivity</div>
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
                  <nav>
                    <ul>
                      <li><a href="/" onClick={(e) => e.preventDefault()}>Home</a></li>
                      <li><a href="/about" onClick={(e) => e.preventDefault()}>About</a></li>
                      <li><button onClick={handleLogout}>Logout</button></li>
                    </ul>
                  </nav>
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
                        Dark Mode
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

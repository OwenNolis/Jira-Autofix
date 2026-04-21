import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import './App.css';
import About from './About';

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  const hasStarted = useRef(false);

  useEffect(() => {
    document.title = 'Jira Autofix';
    return () => {
      document.title = 'Jira Autofix';
    };
  }, []);

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      return;
    }
    if (isLoading) {
      document.title = 'Processing... | Jira Autofix';
    } else {
      document.title = 'Fix Complete | Jira Autofix';
    }
  }, [isLoading]);

  useEffect(() => {
    document.body.className = isDarkMode ? 'dark-mode' : '';
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  const handleRunAIFix = () => {
    setIsLoading(true);
    // Simulate a 2-second processing time
    setTimeout(() => {
      alert('AI Fix triggered!');
      setIsLoading(false);
    }, 2000);
  };

  const toggleDarkMode = () => {
    setIsDarkMode((prevMode) => !prevMode);
  };

  return (
    <Router>
      <div className="App">
        <nav>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/about">About</Link></li>
          </ul>
        </nav>
        <Routes>
          <Route
            path="/"
            element={
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
            }
          />
          <Route path="/about" element={<About />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

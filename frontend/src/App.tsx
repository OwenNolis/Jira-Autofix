import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(false);
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

  const handleRunAIFix = () => {
    setIsLoading(true);
    // Simulate a 2-second processing time
    setTimeout(() => {
      alert('AI Fix triggered!');
      setIsLoading(false);
    }, 2000);
  };

  return (
    <div className="App">
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
      </div>
    </div>
  );
}

export default App;
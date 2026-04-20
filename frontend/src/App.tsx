import React, { useState } from 'react';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(false);

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
          style={{ backgroundColor: 'red' }}
        >
          {isLoading ? 'Processing...' : 'Run AI Fix'}
        </button>
        {isLoading && <div className="spinner"></div>}
      </div>
    </div>
  );
}

export default App;
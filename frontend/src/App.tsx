// Updated App.tsx
import React from 'react';
import './App.css';
import { isAuthenticated } from './auth';

function App() {
  return (
    <div>
      {isAuthenticated() && (
        <nav>
          <ul>
            <li><a href="/home">Home</a></li>
            <li><a href="/about">About</a></li>
            <li><a href="/logout" className="logout-link">Logout</a></li>
          </ul>
        </nav>
      )}
      <div className="home-page-card">
        <button className="image-popup-button">Image Popup</button>
        <button className="run-ai-fix-button">Run AI Fix</button>
      </div>
    </div>
  );
}

export default App;
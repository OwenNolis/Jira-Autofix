// Updated App.tsx to use NavigationBar component
import React from 'react';
import './App.css';
import NavigationBar from './NavigationBar';

function App() {
  return (
    <div className="App">
      {/* Use the reusable NavigationBar component */}
      <NavigationBar isAuthenticated={false} />

      {/* Polished home page appearance */}
      <div className="home">
        <h1>Welcome to MyApp</h1>
        <p>Your one-stop solution for all your needs.</p>
      </div>
    </div>
  );
}

export default App;
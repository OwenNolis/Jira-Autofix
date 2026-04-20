import './App.css';

function App() {
  return (
    <div className="App">
      <div className="card">
        <h1>Jira Autofix</h1>
        <p>Trigger an AI-powered fix for your Jira issues.</p>
        <button className="order-button" onClick={() => alert('Fix triggered!')}>Run AI Fix</button>
      </div>
    </div>
  );
}

export default App;

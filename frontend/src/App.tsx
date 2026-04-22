import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import './App.css';
import About from './About';
import Login from './Login';

// Sun and Moon SVG icons
const SunIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="2" fill="none"/>
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="2"/>
  </svg>
);
const MoonIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 12.79A9 9 0 0111.21 3c0 .34.02.68.05 1.01A7 7 0 1012 21a9 9 0 009-8.21z" stroke="currentColor" strokeWidth="2" fill="none"/>
  </svg>
);

// New Map page component
function Map() {
  return (
    <div className="map-page">
      <h1>Map</h1>
      <p>This is the Map page. Here you can view the project map or related visualizations.</p>
    </div>
  );
}

// --- Pipeline Run Dashboard ---

type PipelineRun = {
  id: number;
  status: string;
  conclusion: string | null;
  created_at: string;
  head_branch: string;
  html_url: string;
};

type PRInfo = {
  prUrl: string;
  prNumber: number;
} | null;

function getStatusBadge(status: string, conclusion: string | null) {
  let label = status;
  let colorClass = 'status-badge-queued';
  if (status === 'completed') {
    if (conclusion === 'success') {
      label = 'Success';
      colorClass = 'status-badge-success';
    } else if (conclusion === 'failure' || conclusion === 'cancelled' || conclusion === 'timed_out') {
      label = 'Failure';
      colorClass = 'status-badge-failure';
    } else {
      label = conclusion ? conclusion.charAt(0).toUpperCase() + conclusion.slice(1) : 'Completed';
      colorClass = 'status-badge-queued';
    }
  } else if (status === 'in_progress') {
    label = 'In Progress';
    colorClass = 'status-badge-inprogress';
  } else if (status === 'queued') {
    label = 'Queued';
    colorClass = 'status-badge-queued';
  }
  return <span className={`status-badge ${colorClass}`}>{label}</span>;
}

function getRelativeTime(isoDate: string): string {
  const now = new Date();
  const then = new Date(isoDate);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

async function fetchPRInfoForRun(run: PipelineRun): Promise<PRInfo> {
  // Try to extract PR number from branch name: ai-fix/issue-{N}-pr-{PR}
  const prMatch = run.head_branch.match(/pr-(\d+)/i);
  if (prMatch) {
    const prNumber = parseInt(prMatch[1], 10);
    return {
      prUrl: `https://github.com/OwenNolis/Jira-Autofix/pull/${prNumber}`,
      prNumber,
    };
  }
  // Fallback: try to find PR via GitHub API (not implemented here for simplicity)
  return null;
}

function extractIssueNumber(branch: string): string | null {
  // ai-fix/issue-{N}-...
  const match = branch.match(/ai-fix\/issue-(\d+)/i);
  return match ? match[1] : null;
}

function PipelineRunDashboard() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [prInfos, setPrInfos] = useState<{ [runId: number]: PRInfo }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  // Fetch runs
  const fetchRuns = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('https://api.github.com/repos/OwenNolis/Jira-Autofix/actions/workflows/ai-fix-from-issue.yml/runs?per_page=10');
      if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);
      const data = await resp.json();
      const runs: PipelineRun[] = data.workflow_runs.map((run: any) => ({
        id: run.id,
        status: run.status,
        conclusion: run.conclusion,
        created_at: run.created_at,
        head_branch: run.head_branch,
        html_url: run.html_url,
      }));
      setRuns(runs);
      setLastUpdated(Date.now());
      // Fetch PR info for each run
      const prInfoPromises = runs.map(async (run) => {
        const prInfo = await fetchPRInfoForRun(run);
        return [run.id, prInfo] as [number, PRInfo];
      });
      const prInfoEntries = await Promise.all(prInfoPromises);
      setPrInfos(Object.fromEntries(prInfoEntries));
    } catch (e: any) {
      setError(e.message || 'Failed to fetch pipeline runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    // eslint-disable-next-line
  }, []);

  // Update relative times every 30s
  useEffect(() => {
    const interval = setInterval(() => setLastUpdated(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="pipeline-dashboard">
      <h2>Recent AI Fix Runs</h2>
      <button className="refresh-btn" onClick={fetchRuns} disabled={loading} aria-label="Refresh run history">
        {loading ? <span className="spinner" aria-label="Loading" /> : 'Refresh'}
      </button>
      {error && <div className="dashboard-error">{error}</div>}
      <div className="dashboard-table-wrapper">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Run</th>
              <th>Issue</th>
              <th>Status</th>
              <th>Started</th>
              <th>PR</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && !loading && !error && (
              <tr><td colSpan={5} style={{ textAlign: 'center' }}>No runs found.</td></tr>
            )}
            {runs.map((run) => {
              const issueNum = extractIssueNumber(run.head_branch);
              const prInfo = prInfos[run.id];
              return (
                <tr key={run.id}>
                  <td><a href={run.html_url} target="_blank" rel="noopener noreferrer">#{run.id}</a></td>
                  <td>{issueNum ? (
                    <a href={`https://agentic-ai-sdlc.atlassian.net/browse/JIRAFIX-${issueNum}`} target="_blank" rel="noopener noreferrer">JIRAFIX-{issueNum}</a>
                  ) : <span className="no-issue">—</span>}</td>
                  <td>{getStatusBadge(run.status, run.conclusion)}</td>
                  <td>{getRelativeTime(run.created_at)}</td>
                  <td>{prInfo ? (
                    <a href={prInfo.prUrl} target="_blank" rel="noopener noreferrer">PR #{prInfo.prNumber}</a>
                  ) : <span className="no-pr">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Inner component — rendered inside <Router> so useNavigate is valid here
function AppContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('isAuthenticated') === 'true';
  });
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);

  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Apply dark mode class to root div
  useEffect(() => {
    // This effect is for body-level styling if needed
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
    alert('You have been logged out.');
    navigate('/login');
  };

  const playHornSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    }
  };

  const toggleAvatarMenu = () => {
    playHornSound();
    setIsAvatarMenuOpen((prev) => !prev);
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (avatarMenuRef.current && !avatarMenuRef.current.contains(event.target as Node)) {
      setIsAvatarMenuOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Dark mode toggle handler
  const handleToggleDarkMode = () => {
    setIsDarkMode((prev) => {
      localStorage.setItem('darkMode', String(!prev));
      return !prev;
    });
  };

  return (
    <div className={`App${isDarkMode ? ' dark' : ''}`}>
      <nav className="navigation-bar">
        <ul className="nav-links">
          <li><Link to="/">Home</Link></li>
          <li><Link to="/about">About</Link></li>
          <li><Link to="/map">Map</Link></li>
        </ul>
        <div className="nav-actions">
          {/* Dark mode toggle button */}
          <button
            className="dark-mode-toggle"
            onClick={handleToggleDarkMode}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            type="button"
          >
            {isDarkMode ? <SunIcon /> : <MoonIcon />}
          </button>
          {isAuthenticated && (
            <div className="avatar-menu" ref={avatarMenuRef}>
              <img
                src="/Hessi.png"
                alt="User Avatar"
                className="avatar"
                onClick={toggleAvatarMenu}
              />
              {/* Use local horn.mp3 instead of remote sound */}
              <audio ref={audioRef} src="/horn.mp3" preload="auto" />
              {isAvatarMenuOpen && (
                <div className="dropdown-menu">
                  <button onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" /> : <Login onLogin={() => setIsAuthenticated(true)} />}
        />
        <Route
          path="/about"
          element={isAuthenticated ? <About /> : <Navigate to="/login" />}
        />
        <Route
          path="/map"
          element={isAuthenticated ? <Map /> : <Navigate to="/login" />}
        />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <div className="home-page">
                <h1>Welcome to Jira Autofix</h1>
                <p>Streamline your development process with AI-powered fixes.</p>
                <PipelineRunDashboard />
              </div>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
      </Routes>
    </div>
  );
}

// Outer shell — only responsible for providing the Router context
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

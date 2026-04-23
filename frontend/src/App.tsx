import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation, Link, useNavigate } from 'react-router-dom';
import './App.css';
import About from './About';
import Login from './Login';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L, { LatLngExpression } from 'leaflet';
import ReactDOM from 'react-dom';

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


const ESSERS_LOCATIONS = [
  { name: "H. Essers HQ", address: "Transportlaan 4, 3600 Genk, Belgium", lat: 50.9659, lng: 5.4979, type: "Headquarters" },
  { name: "H. Essers Hasselt", address: "Kuringersteenweg 506, 3500 Hasselt, Belgium", lat: 50.9311, lng: 5.3378, type: "Regional Hub" },
  { name: "H. Essers Antwerp", address: "Luithagen-Haven 4, 2030 Antwerp, Belgium", lat: 51.2593, lng: 4.3831, type: "Port Depot" },
  { name: "H. Essers Liège", address: "Rue de l'Aéroport 1, 4460 Liège, Belgium", lat: 50.6337, lng: 5.4432, type: "Regional Hub" },
  { name: "H. Essers Rotterdam", address: "Coloradoweg 30, 3199 LD Rotterdam, Netherlands", lat: 51.8761, lng: 4.3193, type: "Port Depot" },
  { name: "H. Essers Milano", address: "Via Fantoli 15, 20138 Milan, Italy", lat: 45.4477, lng: 9.2659, type: "Regional Hub" },
  { name: "H. Essers Barcelona", address: "Carrer de la Llacuna 162, 08018 Barcelona, Spain", lat: 41.4036, lng: 2.1971, type: "Regional Hub" },
  { name: "H. Essers Warsaw", address: "ul. Żwirki i Wigury 1, 00-906 Warsaw, Poland", lat: 52.1657, lng: 20.9671, type: "Regional Hub" },
  { name: "H. Essers Bucharest", address: "Șoseaua de Centură 1, Bucharest, Romania", lat: 44.4268, lng: 26.1025, type: "Regional Hub" },
  { name: "H. Essers Stuttgart", address: "Flughafenstraße 50, 70629 Stuttgart, Germany", lat: 48.6894, lng: 9.1922, type: "Regional Hub" },
];

// Fix Leaflet marker icon issue in React
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Remove default icon globally
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon.options.iconUrl,
  iconRetinaUrl: markerIcon.options.iconRetinaUrl,
  shadowUrl: markerIcon.options.shadowUrl,
});

const TYPE_COLORS: Record<string, string> = {
  'Headquarters': '#007bff',
  'Regional Hub': '#4caf50',
  'Port Depot': '#ff9800',
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className="essers-type-badge"
      style={{ background: TYPE_COLORS[type] || '#bdbdbd', color: '#fff', borderRadius: 12, padding: '3px 12px', fontWeight: 600, fontSize: '0.98em', marginLeft: 8 }}
    >
      {type}
    </span>
  );
}

function MapSidePanel({ location, open, onClose }: { location: typeof ESSERS_LOCATIONS[0] | null, open: boolean, onClose: () => void }) {
  if (!open || !location) return null;
  return ReactDOM.createPortal(
    <div className="essers-sidepanel-overlay" onClick={onClose}>
      <aside className="essers-sidepanel" onClick={e => e.stopPropagation()}>
        <button className="essers-sidepanel-close" onClick={onClose} aria-label="Close panel">×</button>
        <h2 style={{ marginTop: 0 }}>{location.name} <TypeBadge type={location.type} /></h2>
        <div style={{ marginBottom: 18, fontSize: '1.08em' }}>{location.address}</div>
        <section className="essers-sidepanel-section">
          <h3>Contact</h3>
          <div style={{ color: '#888', fontStyle: 'italic' }}>Contact info coming soon.</div>
        </section>
      </aside>
    </div>,
    document.body
  );
}

function EssersMap() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<typeof ESSERS_LOCATIONS[0] | null>(null);

  // Center on Europe
  const center: LatLngExpression = [50.5, 10];

  // Keyboard close for sidepanel
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClosePanel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line
  }, [panelOpen]);

  const onOpenPanel = (loc: typeof ESSERS_LOCATIONS[0]) => {
    setSelectedLocation(loc);
    setPanelOpen(true);
  };
  const onClosePanel = () => {
    setPanelOpen(false);
    setSelectedLocation(null);
  };

  return (
    <div className="map-page essers-map-wrapper">
      <h1>H. Essers Locations Map</h1>
      <div className="essers-map-container">
        <MapContainer center={center} zoom={5} style={{ height: '70vh', width: '100%', minHeight: 400, borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }} scrollWheelZoom={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {ESSERS_LOCATIONS.map((loc, idx) => (
            <Marker key={idx} position={[loc.lat, loc.lng]} icon={markerIcon}>
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: '1.08em', marginBottom: 2 }}>{loc.name}</div>
                  <TypeBadge type={loc.type} />
                  <div style={{ margin: '8px 0 8px 0', fontSize: '0.98em' }}>{loc.address}</div>
                  <button
                    className="essers-popup-btn"
                    onClick={() => onOpenPanel(loc)}
                    style={{ background: '#007bff', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', fontWeight: 600, cursor: 'pointer', fontSize: '1em' }}
                  >
                    View details
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <MapSidePanel location={selectedLocation} open={panelOpen} onClose={onClosePanel} />
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
          element={isAuthenticated ? <EssersMap /> : <Navigate to="/login" />}
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

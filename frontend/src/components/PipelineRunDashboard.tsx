import React, { useState, useEffect } from 'react';

// Only show the AI Fix from Issue pipeline for the home dashboard
const PIPELINE_OPTIONS = [
  {
    key: 'ai-fix-from-issue',
    label: 'AI Fix from Jira Issue',
    workflowFile: 'ai-fix-from-issue.yml',
    description: 'Runs triggered by Jira → GitHub Issue → AI Fix',
  },
];

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
      const pipeline = PIPELINE_OPTIONS[0];
      const ghToken = process.env.REACT_APP_GITHUB_TOKEN;
      const ghHeaders: Record<string, string> = { 'Accept': 'application/vnd.github+json' };
      if (ghToken) ghHeaders['Authorization'] = `Bearer ${ghToken}`;
      const resp = await fetch(`https://api.github.com/repos/OwenNolis/Jira-Autofix/actions/workflows/${pipeline.workflowFile}/runs?per_page=10`, { headers: ghHeaders });
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ marginBottom: 0 }}>Recent AI Fix Runs</h2>
        <button className="refresh-btn" onClick={fetchRuns} disabled={loading} aria-label="Refresh run history">
          {loading ? <span className="spinner" aria-label="Loading" /> : 'Refresh'}
        </button>
      </div>
      <div style={{ margin: '6px 0 18px 0', color: '#888', fontSize: '1.02em' }}>{PIPELINE_OPTIONS[0].description}</div>
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
                  ) : (
                    <span className="no-issue">—</span>
                  )}</td>
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

export default PipelineRunDashboard;

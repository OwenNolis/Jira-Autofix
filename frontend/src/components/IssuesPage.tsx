import React, { useState, useEffect } from 'react';

type JiraIssue = {
  key: string;
  summary: string;
  status: string;
  priority: string;
  type: string;
  url: string;
};

function getJiraStatusBadge(status: string) {
  let colorClass = 'jira-status-badge-default';
  if (/to do/i.test(status)) colorClass = 'jira-status-badge-todo';
  else if (/in progress/i.test(status)) colorClass = 'jira-status-badge-inprogress';
  else if (/done|closed|resolved/i.test(status)) colorClass = 'jira-status-badge-done';
  return <span className={`jira-status-badge ${colorClass}`}>{status}</span>;
}

function getJiraPriorityBadge(priority: string) {
  let colorClass = 'jira-priority-badge-default';
  if (/high/i.test(priority)) colorClass = 'jira-priority-badge-high';
  else if (/medium/i.test(priority)) colorClass = 'jira-priority-badge-medium';
  else if (/low/i.test(priority)) colorClass = 'jira-priority-badge-low';
  return <span className={`jira-priority-badge ${colorClass}`}>{priority}</span>;
}

function getJiraTypeBadge(type: string) {
  let colorClass = 'jira-type-badge-default';
  if (/bug/i.test(type)) colorClass = 'jira-type-badge-bug';
  else if (/task/i.test(type)) colorClass = 'jira-type-badge-task';
  else if (/story/i.test(type)) colorClass = 'jira-type-badge-story';
  return <span className={`jira-type-badge ${colorClass}`}>{type}</span>;
}

function IssuesPage() {
  const [issues, setIssues] = useState<JiraIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  const fetchIssues = async () => {
    setLoading(true);
    setError(null);
    try {
      // Jira issues are synced to GitHub Issues by the poller — fetch from
      // GitHub instead to avoid CORS and auth problems with Jira's UI URLs.
      const ghToken = process.env.REACT_APP_GITHUB_TOKEN;
      const ghHeaders: Record<string, string> = { 'Accept': 'application/vnd.github+json' };
      if (ghToken) ghHeaders['Authorization'] = `Bearer ${ghToken}`;
      const resp = await fetch(
        'https://api.github.com/repos/OwenNolis/Jira-Autofix/issues?state=open&per_page=50',
        { headers: ghHeaders }
      );
      if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);
      const data = await resp.json();

      // Map GitHub issues to the shape the table expects
      const mapped = data.filter((issue: any) => !issue.pull_request).map((issue: any) => {
        const keyMatch = issue.title.match(/\[([A-Z]+-\d+)\]/);
        const key = keyMatch ? keyMatch[1] : `GH-${issue.number}`;
        const summary = issue.title.replace(/\[[A-Z]+-\d+\]\s*/, '');
        const labels: string[] = issue.labels.map((l: any) => l.name);
        const status = labels.find((l: string) => ['To Do', 'In Progress', 'Done'].includes(l)) || 'To Do';
        const priority = labels.find((l: string) => ['High', 'Medium', 'Low'].includes(l)) || 'Medium';
        const type = labels.find((l: string) => ['Bug', 'Task', 'Story'].includes(l)) || 'Task';
        return { key, summary, status, priority, type, url: issue.html_url };
      });

      setIssues(mapped);
      setLastUpdated(Date.now());
    } catch (e: any) {
      setError(e.message || 'Failed to fetch issues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
    // eslint-disable-next-line
  }, []);

  // Update relative times every 30s
  useEffect(() => {
    const interval = setInterval(() => setLastUpdated(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="issues-page">
      <h1>GitHub Issues (Jira-Autofix)</h1>
      <button className="refresh-btn" onClick={fetchIssues} disabled={loading} aria-label="Refresh issues list">
        {loading ? <span className="spinner" aria-label="Loading" /> : 'Refresh'}
      </button>
      {error && <div className="dashboard-error">{error}</div>}
      <div className="issues-table-wrapper">
        <table className="issues-table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Summary</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Type</th>
              <th>Created</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {issues.length === 0 && !loading && !error && (
              <tr><td colSpan={7} style={{ textAlign: 'center' }}>No issues found.</td></tr>
            )}
            {issues.map((issue) => (
              <tr key={issue.key}>
                <td>
                  <a href={issue.url} target="_blank" rel="noopener noreferrer">{issue.key}</a>
                </td>
                <td>{issue.summary}</td>
                <td>{getJiraStatusBadge(issue.status)}</td>
                <td>{getJiraPriorityBadge(issue.priority)}</td>
                <td>{getJiraTypeBadge(issue.type)}</td>
                <td>—</td>
                <td>—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default IssuesPage;

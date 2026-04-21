import React, { useEffect, useState } from 'react';

interface RunHistoryProps {
  onClear: () => void;
}

const RunHistory: React.FC<RunHistoryProps> = ({ onClear }) => {
  const [history, setHistory] = useState<{ timestamp: string; status: string }[]>([]);

  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem('runHistory') || '[]');
    setHistory(savedHistory);
  }, []);

  const formatTimestamp = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="run-history">
      <h3>Run History</h3>
      <ul>
        {history.map((entry, index) => (
          <li key={index}>
            {formatTimestamp(entry.timestamp)} - {entry.status}
          </li>
        ))}
      </ul>
      <button onClick={onClear}>Clear History</button>
    </div>
  );
};

export default RunHistory;
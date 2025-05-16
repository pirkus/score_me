import React, { useEffect, useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const ScorecardsList = ({ user, onViewScorecard }) => {
  const [scorecards, setScorecards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || !user.token) {
      return;
    }

    const fetchScorecards = async () => {
      try {
        const res = await fetch(`${API_URL}/scorecards`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || res.statusText);
        }
        const data = await res.json();
        setScorecards(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchScorecards();
  }, [user]);

  if (!user) return <p>Please login to view your scorecards.</p>;
  if (loading) return <p>Loading scorecards...</p>;
  if (error) return <p className="error-message">Error: {error}</p>;
  if (scorecards.length === 0) return <p>No scorecards found.</p>;

  return (
    <div className="scorecards-list">
      <h2>Your Scorecards</h2>
      <table className="scorecard-table">
        <thead>
          <tr>
            <th>Config Name</th>
            <th>Date Range</th>
            <th>Date Created</th>
            <th>General Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {scorecards.map((sc, idx) => (
            <tr key={idx}>
              <td data-label="Config Name">{sc.configName}</td>
              <td data-label="Date Range">{sc.startDate} - {sc.endDate}</td>
              <td data-label="Date Created">{sc.dateCreated?.split('T')[0]}</td>
              <td data-label="General Notes">{sc.generalNotes || '—'}</td>
              <td data-label="Actions">
                <button 
                  onClick={() => onViewScorecard(sc.id)}
                  className="view-button"
                >
                  👁️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ScorecardsList; 
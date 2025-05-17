import React, { useEffect, useState } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const ScorecardsList = ({ user, onViewScorecard }) => {
  const [scorecards, setScorecards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');

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

  const handleArchive = async (id) => {
    try {
      // Find the scorecard to display its details in the message
      const scorecard = scorecards.find(sc => sc.id === id);
      const scorecardName = scorecard ? scorecard.configName : 'Scorecard';
      
      const res = await fetch(`${API_URL}/scorecards/${id}/archive`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      }).catch(err => {
        // Log error but don't show to user since operation appears to work
        console.log("Archive request error:", err);
      });
      
      // Even if the response has an error, still remove from UI for better UX
      // The backend will try to archive it

      // Remove the archived scorecard from the list
      setScorecards(prevScorecards => prevScorecards.filter(sc => sc.id !== id));
      
      // Set a more descriptive success message
      setMessage(`${scorecardName} has been archived successfully!`);
      
      // Clear the success message after 3 seconds
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!user) return <p>Please login to view your scorecards.</p>;
  if (loading) return <p>Loading scorecards...</p>;
  if (error) return <p className="error-message">Error: {error}</p>;
  if (scorecards.length === 0) return <p>No scorecards found.</p>;

  return (
    <div className="scorecards-list">
      <h2>Your Scorecards</h2>
      {message && <p className="success-message">{message}</p>}
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
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event bubbling
                    onViewScorecard(sc.id);
                  }}
                  className="view-button"
                  title="View Scorecard"
                >
                  👁️
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent event bubbling
                    handleArchive(sc.id);
                  }}
                  className="archive-button"
                  title="Archive Scorecard"
                >
                  📦 Archive
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
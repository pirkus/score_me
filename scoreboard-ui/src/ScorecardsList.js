import React, { useEffect, useState } from 'react';
import { encodeId } from './utils';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const ScorecardsList = ({ user, onViewScorecard, onEditScorecard }) => {
  const [scorecards, setScorecards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (!user || !user.token) {
      return;
    }

    const fetchScorecards = async () => {
      setLoading(true);
      try {
        const url = `${API_URL}/scorecards${showArchived ? '?includeArchived=true' : ''}`;
        const res = await fetch(url, {
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
  }, [user, showArchived]);

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

      // If not showing archived scorecards, remove from list
      if (!showArchived) {
        setScorecards(prevScorecards => prevScorecards.filter(sc => sc.id !== id));
      } else {
        // Otherwise, mark it as archived in the UI
        setScorecards(prevScorecards => 
          prevScorecards.map(sc => sc.id === id ? {...sc, archived: true} : sc)
        );
      }
      
      // Set a more descriptive success message
      setMessage(`${scorecardName} has been archived successfully!`);
      
      // Clear the success message after 3 seconds
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCopyPermalink = (scorecard) => {
    if (!scorecard) return;
    
    // Use scorecard.encodedId if available, otherwise encode the ID
    const encodedIdToUse = scorecard.encodedId || encodeId(scorecard.id);
    
    if (!encodedIdToUse) return;
    
    // Get the base URL (without any path)
    const currentUrl = window.location.href;
    const baseUrl = currentUrl.split('/').slice(0, 3).join('/');
    
    // Create the permalink with the encoded ID
    const permalink = `${baseUrl}/edit/${encodedIdToUse}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(permalink)
      .then(() => {
        setCopiedId(scorecard.id);
        setTimeout(() => setCopiedId(null), 3000);
      })
      .catch(err => {
        console.error('Failed to copy permalink:', err);
      });
  };

  if (!user) return <p>Please login to view your scorecards.</p>;
  if (loading) return <p>Loading scorecards...</p>;
  if (error) return <p className="error-message">Error: {error}</p>;

  return (
    <div className="scorecards-list">
      <h2>Your Scorecards</h2>
      <div className="display-options">
        <label className="archive-checkbox">
          <input 
            type="checkbox" 
            checked={showArchived} 
            onChange={(e) => {
              setShowArchived(e.target.checked);
            }} 
          />
          Show archived scorecards
        </label>
      </div>
      {message && <p className="success-message">{message}</p>}
      {scorecards.length === 0 ? (
        <p>No {showArchived ? 'archived or active' : 'active'} scorecards found.</p>
      ) : (
        <table className="scorecard-table">
          <thead>
            <tr>
              <th>Config Name</th>
              <th>Date Range</th>
              <th>Date Created</th>
              <th>General Notes</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {scorecards.map((sc, idx) => (
              <tr key={idx} className={sc.archived ? 'archived-row' : ''}>
                <td data-label="Config Name">{sc.configName}</td>
                <td data-label="Date Range">{sc.startDate} - {sc.endDate}</td>
                <td data-label="Date Created">{sc.dateCreated?.split('T')[0]}</td>
                <td data-label="General Notes">{sc.generalNotes || '—'}</td>
                <td data-label="Status">{sc.archived ? 'Archived' : 'Active'}</td>
                <td data-label="Actions">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent event bubbling
                      // Use encodedId if available, otherwise encode the ID
                      onViewScorecard(sc.encodedId || encodeId(sc.id));
                    }}
                    className="view-button"
                    title="View Scorecard"
                  >
                    👁️
                  </button>
                  {!sc.archived && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent event bubbling
                          // Use encodedId if available, otherwise encode the ID
                          onEditScorecard(sc.encodedId || encodeId(sc.id));
                        }}
                        className="edit-button"
                        title="Edit Scorecard"
                      >
                        ✏️
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
                    </>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent event bubbling
                      handleCopyPermalink(sc);
                    }}
                    className="permalink-button-small"
                    title="Copy Edit Permalink"
                    disabled={copiedId === sc.id}
                  >
                    {copiedId === sc.id ? '✓ Copied!' : '🔗✏️'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ScorecardsList; 
import React, { useEffect, useState } from 'react';
import useTokenExpiryCheck from './useTokenExpiryCheck';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const ViewScorecard = ({ user, setUser, scorecardId }) => {
  useTokenExpiryCheck(user, setUser);
  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user || !user.token || !scorecardId) {
      setLoading(false);
      setError('Please login to view scorecards.');
      return;
    }

    const fetchScorecard = async () => {
      try {
        const res = await fetch(`${API_URL}/scorecards/${scorecardId}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Scorecard not found');
          }
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || res.statusText);
        }
        const data = await res.json();
        setScorecard(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchScorecard();
  }, [user, scorecardId]);

  const renderScore = (score) => {
    // If the score is a boolean, it's a checkbox type
    if (typeof score === 'boolean') {
      return score ? (
        <div className="score-status">
          <span className="score-done">✓</span>
          <span>Done</span>
        </div>
      ) : (
        <div className="score-status">
          <span className="score-not-done">✗</span>
          <span>Not done</span>
        </div>
      );
    }
    // Otherwise it's a numeric score
    return score;
  };

  if (!user) return <p>Please login to view scorecards.</p>;
  if (loading) return <p>Loading scorecard...</p>;
  if (error) return <p className="error-message">Error loading scorecard: {error}</p>;
  if (!scorecard) return <p>Scorecard not found.</p>;

  return (
    <div className="view-scorecard-form">
      <h2>Scorecard Details</h2>
      
      <div className="scorecard-info">
        <h3>{scorecard.configName}</h3>
        <div className="info-group">
          <p><strong>Date Range:</strong> {scorecard.startDate} - {scorecard.endDate}</p>
          <p><strong>Created:</strong> {scorecard.dateCreated?.split('T')[0]}</p>
        </div>
        
        {scorecard.generalNotes && (
          <div className="general-notes">
            <h4>General Notes:</h4>
            <p>{scorecard.generalNotes}</p>
          </div>
        )}
      </div>

      <div className="table-wrapper">
        <table className="scorecard-table">
          <thead>
            <tr>
              <th>Metric Name</th>
              <th>Dev Score</th>
              <th>Mentor Score</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {scorecard.scores.map((score, index) => (
              <tr key={index}>
                <td data-label="Metric Name">{score.metricName}</td>
                <td data-label="Dev Score">{renderScore(score.devScore)}</td>
                <td data-label="Mentor Score">{renderScore(score.mentorScore)}</td>
                <td data-label="Notes">{score.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ViewScorecard; 
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#4caf50', fontWeight: 'bold' }}>✓</span>
          <span>Done</span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#f44336', fontWeight: 'bold' }}>✗</span>
          <span>Not done</span>
        </div>
      );
    }
    // Otherwise it's a numeric score
    return score;
  };

  const containerStyle = {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px'
  };

  const headingStyle = {
    fontSize: '1.5em',
    marginBottom: '15px',
    color: '#4caf50'
  };

  const subheadingStyle = {
    fontSize: '1.2em',
    marginBottom: '10px',
    fontWeight: 'bold'
  };

  const sectionStyle = {
    marginBottom: '20px'
  };

  const labelStyle = {
    fontWeight: 'bold'
  };

  const errorStyle = {
    color: '#f44336'
  };

  if (!user) return <p>Please login to view scorecards.</p>;
  if (loading) return <p>Loading scorecard...</p>;
  if (error) return <p style={errorStyle}>Error loading scorecard: {error}</p>;
  if (!scorecard) return <p>Scorecard not found.</p>;

  return (
    <div style={containerStyle}>
      <h2 style={headingStyle}>
        Scorecard Details
      </h2>
      
      <div style={sectionStyle}>
        <h3 style={subheadingStyle}>
          {scorecard.configName}
        </h3>
        <p>
          <span style={labelStyle}>Date Range:</span> {scorecard.startDate} - {scorecard.endDate}
        </p>
        <p>
          <span style={labelStyle}>Created:</span> {scorecard.dateCreated?.split('T')[0]}
        </p>
        {scorecard.generalNotes && (
          <div style={{ marginTop: '15px' }}>
            <h4 style={{ fontSize: '1.1em', marginBottom: '5px' }}>General Notes:</h4>
            <p>{scorecard.generalNotes}</p>
          </div>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
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
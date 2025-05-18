// CreateScorecard.js
import React, { useState, useEffect, useCallback } from 'react';
import useTokenExpiryCheck from './useTokenExpiryCheck';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const CreateScorecard = ({ user, setUser, configs }) => {
  useTokenExpiryCheck(user, setUser);

  const [selectedConfigName, setSelectedConfigName] = useState('');
  const [selectedConfigDetails, setSelectedConfigDetails] = useState(null);
  const [scores, setScores] = useState([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (selectedConfigName && configs.length > 0) {
      const config = configs.find(c => c.name === selectedConfigName || c.id === selectedConfigName);
      if (config) {
        setSelectedConfigDetails(config);
        setScores(config.metrics.map(metric => ({
          metricName: metric.name,
          scoreType: metric.scoreType || 'numeric',
          devScore: metric.scoreType === 'checkbox' ? false : '',
          mentorScore: metric.scoreType === 'checkbox' ? false : '',
          notes: ''
        })));
        setErrors({});
        setMessage('');
      } else {
        setSelectedConfigDetails(null);
        setScores([]);
      }
    } else {
      setSelectedConfigDetails(null);
      setScores([]);
    }
  }, [selectedConfigName, configs]);

  const handleScoreChange = useCallback((index, field, value) => {
    setScores(prevScores =>
      prevScores.map((score, i) =>
        i === index ? { ...score, [field]: value } : score
      )
    );
    setErrors(prevErrors => ({
      ...prevErrors,
      scores: {
        ...prevErrors.scores,
        [index]: {
          ...prevErrors.scores?.[index],
          [field]: ''
        }
      }
    }));
  }, []);

  const validateForm = useCallback(() => {
    const newErrors = { scores: {} };
    let isValid = true;

    if (!selectedConfigName) {
      newErrors.config = "Please select a configuration.";
      isValid = false;
    }

    if (!startDate) {
      newErrors.startDate = "Start date is required.";
      isValid = false;
    }

    if (!endDate) {
      newErrors.endDate = "End date is required.";
      isValid = false;
    }

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      newErrors.dateRange = "Start date must be before end date.";
      isValid = false;
    }

    scores.forEach((score, index) => {
      const metric = selectedConfigDetails?.metrics[index];
      if (metric?.scoreType === 'checkbox') {
        // Checkbox validation
        if (typeof score.devScore !== 'boolean') {
          newErrors.scores[index] = { ...newErrors.scores[index], devScore: "Dev score must be checked or unchecked." };
          isValid = false;
        }
        if (typeof score.mentorScore !== 'boolean') {
          newErrors.scores[index] = { ...newErrors.scores[index], mentorScore: "Mentor score must be checked or unchecked." };
          isValid = false;
        }
      } else {
        // Numeric validation
        if (score.devScore === '') {
          newErrors.scores[index] = { ...newErrors.scores[index], devScore: "Dev score cannot be empty." };
          isValid = false;
        } else if (isNaN(score.devScore) || Number(score.devScore) < 0 || Number(score.devScore) > 10) {
          newErrors.scores[index] = { ...newErrors.scores[index], devScore: "Score must be between 0 and 10." };
          isValid = false;
        }

        if (score.mentorScore === '') {
          newErrors.scores[index] = { ...newErrors.scores[index], mentorScore: "Mentor score cannot be empty." };
          isValid = false;
        } else if (isNaN(score.mentorScore) || Number(score.mentorScore) < 0 || Number(score.mentorScore) > 10) {
          newErrors.scores[index] = { ...newErrors.scores[index], mentorScore: "Score must be between 0 and 10." };
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [selectedConfigName, scores, startDate, endDate, selectedConfigDetails]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setMessage('');
    if (!validateForm()) {
      return;
    }

    if (!user || !user.token || !selectedConfigDetails) {
      setMessage('❌ Error: User not authenticated or config not selected.');
      return;
    }

    const scoreboardData = {
      configName: selectedConfigDetails.name,
      email: user.decoded.email,
      scores: scores.map(s => ({
        metricName: s.metricName,
        devScore: s.scoreType === 'checkbox' ? s.devScore : Number(s.devScore),
        mentorScore: s.scoreType === 'checkbox' ? s.mentorScore : Number(s.mentorScore),
        notes: s.notes,
      })),
      generalNotes: generalNotes,
      startDate: startDate,
      endDate: endDate,
      dateCreated: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${API_URL}/create-scoreboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(scoreboardData),
      });

      if (res.ok) {
        const result = await res.json();
        setMessage(`✅ Scorecard submitted successfully! ID: ${result.id || result._id}`);
        setSelectedConfigName('');
        setSelectedConfigDetails(null);
        setScores([]);
        setGeneralNotes('');
        setStartDate('');
        setEndDate('');
        setErrors({});
      } else {
        const errorData = await res.json().catch(() => ({ message: res.statusText }));
        setMessage(`❌ Error submitting scorecard: ${errorData?.error || errorData?.message || res.statusText}`);
      }
    } catch (error) {
      console.error("Network or other error:", error);
      setMessage(`❌ Network error: ${error.message}`);
    }
  }, [user, selectedConfigDetails, scores, generalNotes, startDate, endDate, validateForm]);

  const renderScoreInput = (score, index) => {
    if (score.scoreType === 'checkbox') {
      return (
        <>
          <td data-label="Dev Score">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={score.devScore}
                onChange={(e) => handleScoreChange(index, 'devScore', e.target.checked)}
              />
              Done
            </label>
          </td>
          <td data-label="Mentor Score">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={score.mentorScore}
                onChange={(e) => handleScoreChange(index, 'mentorScore', e.target.checked)}
              />
              Done
            </label>
          </td>
        </>
      );
    }

    return (
      <>
        <td data-label="Dev Score">
          <input
            type="number"
            role="spinbutton"
            aria-label={`Dev score for ${score.metricName}`} 
            value={score.devScore}
            onChange={(e) => handleScoreChange(index, 'devScore', e.target.value)}
            min="0" 
            max="10" 
            step="0.5"
          />
          {errors.scores?.[index]?.devScore && 
            <p className="error-message small">{errors.scores[index].devScore}</p>
          }
        </td>
        <td data-label="Mentor Score">
          <input
            type="number"
            role="spinbutton"
            aria-label={`Mentor score for ${score.metricName}`}
            value={score.mentorScore}
            onChange={(e) => handleScoreChange(index, 'mentorScore', e.target.value)}
            min="0" 
            max="10" 
            step="0.5"
          />
          {errors.scores?.[index]?.mentorScore && 
            <p className="error-message small">{errors.scores[index].mentorScore}</p>
          }
        </td>
      </>
    );
  };

  if (!user) {
    return <p>Please log in to create a scorecard.</p>;
  }

  return (
    <div className="form-view">
      <div className="form-container create-scorecard-form">
        <h2>Create Scorecard</h2>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="config-select">Select Configuration:</label>
            <select
              id="config-select"
              value={selectedConfigName}
              onChange={(e) => setSelectedConfigName(e.target.value)}
              required
            >
              <option value="">-- Select a configuration --</option>
              {configs.map((config) => (
                <option key={config.id} value={config.name}>
                  {config.name}
                </option>
              ))}
            </select>
            {errors.config && <p className="error-message">{errors.config}</p>}
          </div>

          <div className="date-range-container">
            <div className="form-group date-input">
              <label htmlFor="start-date">Start Date:</label>
              <input
                type="date"
                id="start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
              {errors.startDate && <p className="error-message">{errors.startDate}</p>}
            </div>
            <div className="form-group date-input">
              <label htmlFor="end-date">End Date:</label>
              <input
                type="date"
                id="end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
              {errors.endDate && <p className="error-message">{errors.endDate}</p>}
            </div>
          </div>
          {errors.dateRange && <p className="error-message">{errors.dateRange}</p>}

          {selectedConfigDetails && (
            <>
              <h3>Metrics for: {selectedConfigDetails.name}</h3>
              <table className="scorecard-table">
                <thead>
                  <tr>
                    <th>Metric Name</th>
                    <th>Score Type</th>
                    <th>Dev Score</th>
                    <th>Mentor Score</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((score, index) => (
                    <tr key={`${selectedConfigName}-${score.metricName}-${index}`}>
                      <td data-label="Metric Name">{score.metricName}</td>
                      <td data-label="Score Type">{score.scoreType}</td>
                      {renderScoreInput(score, index)}
                      <td data-label="Notes">
                        <textarea
                          aria-label={`Notes for ${score.metricName}`}
                          value={score.notes}
                          onChange={(e) => handleScoreChange(index, 'notes', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="form-group">
                <label htmlFor="general-notes">General Notes:</label>
                <textarea
                  id="general-notes"
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  rows={4}
                />
              </div>

              <button type="submit" className="submit-button">
                Submit Scorecard
              </button>
            </>
          )}

          {message && (
            <p className={message.startsWith("✅") ? "success-message" : "error-message"}>
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default CreateScorecard;

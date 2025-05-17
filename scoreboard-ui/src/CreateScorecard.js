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
        // Initialize scores based on the metrics of the selected config
        // Metrics are identified by their name.
        setScores(config.metrics.map(metric => ({
          metricName: metric.name, // Use name as the primary identifier from the config
          expectation: metric.expectation, // Store expectation for display, not necessarily for payload
          devScore: '',
          mentorScore: '',
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
      if (score.devScore.trim() === '') {
        newErrors.scores[index] = { ...newErrors.scores[index], devScore: "Dev score cannot be empty." };
        isValid = false;
      } else if (isNaN(score.devScore) || Number(score.devScore) < 0 || Number(score.devScore) > 10) {
        newErrors.scores[index] = { ...newErrors.scores[index], devScore: "Dev score must be a number between 0 and 10." };
        isValid = false;
      }

      if (score.mentorScore.trim() === '') {
        newErrors.scores[index] = { ...newErrors.scores[index], mentorScore: "Mentor score cannot be empty." };
        isValid = false;
      } else if (isNaN(score.mentorScore) || Number(score.mentorScore) < 0 || Number(score.mentorScore) > 10) {
        newErrors.scores[index] = { ...newErrors.scores[index], mentorScore: "Mentor score must be a number between 0 and 10." };
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [selectedConfigName, scores, startDate, endDate]);

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
      // Scores payload will send metricName. Backend will match based on this.
      scores: scores.map(s => ({
        metricName: s.metricName, // This is the key identifier for the metric
        devScore: Number(s.devScore),
        mentorScore: Number(s.mentorScore),
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


  if (!user) {
    return <p>Please log in to create a scorecard.</p>;
  }

  return (
    <div className="create-scorecard-form form-container">
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
            <option value="">-- Choose a Config --</option>
            {configs.length > 0 ? (
              configs.map(config => (
                <option key={config.name} value={config.name}>
                  {config.name}
                </option>
              ))
            ) : (
              <option value="" disabled>Loading configs...</option>
            )}
          </select>
          {errors.config && <p className="error-message">{errors.config}</p>}
        </div>

        {selectedConfigDetails && (
          <>
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

            <h3>Metrics for: {selectedConfigDetails.name}</h3>
            <table className="scorecard-table">
              <thead>
                <tr>
                  <th>Metric Name</th>
                  <th>Expectation</th>
                  <th>Dev Score (0-10)</th>
                  <th>Mentor Score (0-10)</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {selectedConfigDetails.metrics.map((metric, index) => (
                  <tr key={`${selectedConfigName}-${metric.name}-${index}`}>
                   <td data-label="Metric Name">{metric.name}</td>
                   <td data-label="Expectation">{metric.expectation}</td>
                   <td data-label="Dev Score">
                     <>
                       <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.1"
                        value={scores[index]?.devScore || ''}
                        onChange={(e) => handleScoreChange(index, 'devScore', e.target.value)}
                        placeholder="0-10"
                        aria-label={`Dev score for ${metric.name}`}
                       />
                       {errors.scores?.[index]?.devScore && <p className="error-message small">{errors.scores[index].devScore}</p>}
                    </>
                  </td>
      <td data-label="Mentor Score">
        <>
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={scores[index]?.mentorScore || ''}
            onChange={(e) => handleScoreChange(index, 'mentorScore', e.target.value)}
            placeholder="0-10"
            aria-label={`Mentor score for ${metric.name}`}
          />
          {errors.scores?.[index]?.mentorScore && <p className="error-message small">{errors.scores[index].mentorScore}</p>}
        </>
      </td>
      <td data-label="Notes">
        <textarea
          value={scores[index]?.notes || ''}
          onChange={(e) => handleScoreChange(index, 'notes', e.target.value)}
          placeholder="Any specific notes..."
          rows="2"
          aria-label={`Notes for ${metric.name}`}
        />
      </td>
    </tr>
  ))}
              </tbody> 
            </table>
            <div className="form-group">
              <label htmlFor="general-notes">General Notes (Optional):</label>
              <textarea
                id="general-notes"
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                rows="3"
                placeholder="Overall comments or summary..."
              />
            </div>
          </>
        )}

        {selectedConfigName && (
          <button type="submit" className="submit-button">Submit Scorecard</button>
        )}
      </form>
      {message && <p className={message.startsWith("✅") ? "success-message" : "main-error-message"}>{message}</p>}
    </div>
  );
};

export default CreateScorecard;

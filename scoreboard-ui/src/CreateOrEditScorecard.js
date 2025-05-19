// CreateOrEditScorecard.js
import React, { useState, useEffect, useCallback } from 'react';
import useTokenExpiryCheck from './useTokenExpiryCheck';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const CreateOrEditScorecard = ({ user, setUser, configs, existingScorecard, onSaveSuccess }) => {
  useTokenExpiryCheck(user, setUser);

  const [selectedConfigName, setSelectedConfigName] = useState('');
  const [selectedConfigDetails, setSelectedConfigDetails] = useState(null);
  const [scores, setScores] = useState([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [scorecardId, setScorecardId] = useState(null);

  // Initialize form with existing scorecard data if provided
  useEffect(() => {
    if (existingScorecard) {
      console.log("Initializing form with existing scorecard:", existingScorecard);
      setIsEditing(true);
      setScorecardId(existingScorecard.id);
      setSelectedConfigName(existingScorecard.configName);
      setGeneralNotes(existingScorecard.generalNotes || '');
      setStartDate(existingScorecard.startDate);
      setEndDate(existingScorecard.endDate);

      // The scores will be populated when the config is loaded in the other useEffect
    }
  }, [existingScorecard]);

  useEffect(() => {
    console.log("Config/scorecard effect running with:", {
      selectedConfigName,
      configsLength: configs.length,
      isEditing,
      existingScorecard: existingScorecard ? true : false
    });

    // If we're in edit mode, we need to make sure we have a matching config
    if (isEditing && existingScorecard && configs.length > 0) {
      const config = configs.find(c => c.name === existingScorecard.configName);
      console.log("Found config for editing:", config);
      
      if (config) {
        // Force select the config that matches the scorecard
        if (selectedConfigName !== config.name) {
          console.log("Setting selected config name to:", config.name);
          setSelectedConfigName(config.name);
        }
        
        setSelectedConfigDetails(config);
        
        console.log("Processing scores for editing with metrics:", config.metrics);
        console.log("Existing scores:", existingScorecard.scores);
        
        // Map existing scores to the format required by the form
        const mappedScores = config.metrics.map(metric => {
          const existingScore = existingScorecard.scores.find(s => s.metricName === metric.name);
          console.log(`Mapping metric ${metric.name}, found score:`, existingScore);
          
          const scoreType = metric.scoreType || 'numeric';
          
          return {
            metricName: metric.name,
            scoreType: scoreType,
            devScore: existingScore ? existingScore.devScore : (scoreType === 'checkbox' ? false : ''),
            mentorScore: existingScore ? existingScore.mentorScore : (scoreType === 'checkbox' ? false : ''),
            notes: existingScore ? existingScore.notes || '' : ''
          };
        });
        console.log("Mapped scores:", mappedScores);
        setScores(mappedScores);
        setErrors({});
        setMessage('');
      }
    } else if (selectedConfigName && configs.length > 0) {
      // Standard flow for selecting a config in create mode or when changing configs
      const config = configs.find(c => c.name === selectedConfigName || c.id === selectedConfigName);
      console.log("Found config by selected name:", config);
      
      if (config) {
        setSelectedConfigDetails(config);
        
        if (isEditing && existingScorecard) {
          // Map existing scores to the format required by the form
          const mappedScores = config.metrics.map(metric => {
            const existingScore = existingScorecard.scores.find(s => s.metricName === metric.name);
            const scoreType = metric.scoreType || 'numeric';
            
            return {
              metricName: metric.name,
              scoreType: scoreType,
              devScore: existingScore ? existingScore.devScore : (scoreType === 'checkbox' ? false : ''),
              mentorScore: existingScore ? existingScore.mentorScore : (scoreType === 'checkbox' ? false : ''),
              notes: existingScore ? existingScore.notes || '' : ''
            };
          });
          setScores(mappedScores);
        } else {
          // Initialize new scores for a new scorecard
          setScores(config.metrics.map(metric => ({
            metricName: metric.name,
            scoreType: metric.scoreType || 'numeric',
            devScore: metric.scoreType === 'checkbox' ? false : '',
            mentorScore: metric.scoreType === 'checkbox' ? false : '',
            notes: ''
          })));
        }
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
  }, [selectedConfigName, configs, isEditing, existingScorecard]);

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
      dateCreated: isEditing ? existingScorecard.dateCreated : new Date().toISOString(),
    };

    // If editing, include the ID
    if (isEditing && scorecardId) {
      scoreboardData._id = scorecardId;
    }

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
        const successMessage = isEditing ? 
          `✅ Scorecard updated successfully! ID: ${result.id || result._id}` :
          `✅ Scorecard submitted successfully! ID: ${result.id || result._id}`;
        
        setMessage(successMessage);
        
        // Clear form if not editing
        if (!isEditing) {
          setSelectedConfigName('');
          setSelectedConfigDetails(null);
          setScores([]);
          setGeneralNotes('');
          setStartDate('');
          setEndDate('');
          setErrors({});
        }
        
        // Call onSaveSuccess callback if provided
        if (onSaveSuccess) {
          onSaveSuccess();
        }
      } else {
        const errorData = await res.json().catch(() => ({ message: res.statusText }));
        setMessage(`❌ Error submitting scorecard: ${errorData?.error || errorData?.message || res.statusText}`);
      }
    } catch (error) {
      console.error("Network or other error:", error);
      setMessage(`❌ Network error: ${error.message}`);
    }
  }, [user, selectedConfigDetails, scores, generalNotes, startDate, endDate, validateForm, isEditing, scorecardId, existingScorecard, onSaveSuccess]);

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
          <div className={errors.scores?.[index]?.devScore ? 'error-input' : ''}>
            <input
              type="number"
              min="0"
              max="10"
              step="0.5"
              value={score.devScore}
              onChange={(e) => handleScoreChange(index, 'devScore', e.target.value)}
              className="score-input"
            />
            {errors.scores?.[index]?.devScore && <div className="error-message">{errors.scores[index].devScore}</div>}
          </div>
        </td>
        <td data-label="Mentor Score">
          <div className={errors.scores?.[index]?.mentorScore ? 'error-input' : ''}>
            <input
              type="number"
              min="0"
              max="10"
              step="0.5"
              value={score.mentorScore}
              onChange={(e) => handleScoreChange(index, 'mentorScore', e.target.value)}
              className="score-input"
            />
            {errors.scores?.[index]?.mentorScore && <div className="error-message">{errors.scores[index].mentorScore}</div>}
          </div>
        </td>
      </>
    );
  };

  if (!user) {
    return <p>Please log in to create a scorecard.</p>;
  }

  return (
    <div className="create-scorecard">
      <h2>{isEditing ? 'Update Scorecard' : 'Create Scorecard'}</h2>

      {message && <div className="message-container">{message}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="config-select">Select Configuration:</label>
          <select
            id="config-select"
            value={selectedConfigName || ''}
            onChange={(e) => setSelectedConfigName(e.target.value)}
            disabled={isEditing}
            className={errors.config ? 'error-input' : ''}
          >
            <option value="">-- Select a configuration --</option>
            {configs.map(config => (
              <option key={config.id || config.name} value={config.name}>
                {config.name}
              </option>
            ))}
          </select>
          {errors.config && <div className="error-message">{errors.config}</div>}
        </div>

        <div className="date-range-container">
          <div className="form-group">
            <label htmlFor="start-date">Start Date:</label>
            <input
              type="date"
              id="start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={errors.startDate || errors.dateRange ? 'error-input' : ''}
            />
            {errors.startDate && <div className="error-message">{errors.startDate}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="end-date">End Date:</label>
            <input
              type="date"
              id="end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={errors.endDate || errors.dateRange ? 'error-input' : ''}
            />
            {errors.endDate && <div className="error-message">{errors.endDate}</div>}
          </div>
        </div>
        {errors.dateRange && <div className="error-message date-range-error">{errors.dateRange}</div>}

        <div className="form-group">
          <label htmlFor="general-notes">General Notes:</label>
          <textarea
            id="general-notes"
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            rows={4}
          />
        </div>

        {selectedConfigDetails && scores.length > 0 && (
          <div className="scores-container">
            <h3>Scores</h3>
            <div className="table-wrapper">
              <table className="scores-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Dev Score</th>
                    <th>Mentor Score</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((score, index) => (
                    <tr key={index}>
                      <td data-label="Metric">{score.metricName}</td>
                      {renderScoreInput(score, index)}
                      <td data-label="Notes">
                        <textarea
                          value={score.notes}
                          onChange={(e) => handleScoreChange(index, 'notes', e.target.value)}
                          placeholder="Add notes (optional)"
                          rows={2}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="button-group">
          <button type="submit" className="submit-button">
            {isEditing ? 'Update Scorecard' : 'Submit Scorecard'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateOrEditScorecard;

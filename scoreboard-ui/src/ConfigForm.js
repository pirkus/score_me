import React, { useState, useCallback } from "react";
import useTokenExpiryCheck from "./useTokenExpiryCheck";

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const ConfigForm = ({ user, setUser, initialData }) => {
  const [name, setName] = useState(initialData?.name || '');
  const [metrics, setMetrics] = useState(initialData?.metrics || [{ name: '', scoreType: 'numeric', expectation: '' }]);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");

  useTokenExpiryCheck(user, setUser);

  const validateForm = useCallback(() => {
    const newErrors = {};
    let isValid = true;

    if (!name.trim()) {
      newErrors.name = "Name cannot be empty";
      isValid = false;
    }

    const metricErrors = metrics.map((metric) => {
      const metricError = {};
      if (!metric.name.trim()) {
        metricError.name = "Metric name cannot be empty";
        isValid = false;
      }
      if (!metric.expectation.trim()) {
        metricError.expectation = "Metric expectation cannot be empty";
        isValid = false;
      }
      return metricError;
    });
    newErrors.metrics = metricErrors;

    setErrors(newErrors);
    return isValid;
  }, [name, metrics]);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!validateForm()) {
        return;
      }

      const config = { name, metrics, email: user.decoded.email };

      try {
        const res = await fetch(`${API_URL}/scoreboard-config`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify(config),
        });

        if (res.ok) {
          setMessage("✅ Config submitted!");
          setErrors({});
        } else {
          try {
            const errorData = await res.json();
            setMessage(`❌ Error submitting config: ${errorData?.error || errorData?.message || res.statusText}`);
          } catch (error) {
            setMessage(`❌ Error submitting config: ${res.statusText}`);
          }
        }
      } catch (error) {
        setMessage(`❌ Network error: ${error.message}`);
      }
    },
    [name, metrics, user, validateForm]
  );

  const addMetric = useCallback(() => {
    setMetrics((prevMetrics) => [...prevMetrics, { name: '', scoreType: 'numeric', expectation: '' }]);
  }, []);

  const removeMetric = useCallback((index) => {
    if (metrics.length > 1) {
      setMetrics((prevMetrics) => prevMetrics.filter((_, i) => i !== index));
      setErrors((prevErrors) => ({
        ...prevErrors,
        metrics: prevErrors.metrics?.filter((_, i) => i !== index),
      }));
    } else {
      alert("At least one metric is required.");
    }
  }, [metrics.length]);

  const updateMetric = useCallback((index, field, value) => {
    setMetrics((prevMetrics) => {
      const newMetrics = [...prevMetrics];
      newMetrics[index] = { ...newMetrics[index], [field]: value };
      return newMetrics;
    });

    setErrors((prevErrors) => ({
      ...prevErrors,
      metrics: prevErrors.metrics?.map((error, i) =>
        i === index ? { ...error, [field]: "" } : error
      ),
    }));
  }, []);

  const formStyle = {
    margin: '0 auto',
    maxWidth: '600px',
    textAlign: 'left'
  };

  const titleStyle = {
    color: '#4caf50',
    textAlign: 'center',
    fontSize: '2em',
    marginBottom: '20px'
  };

  const fieldLabelStyle = {
    display: 'block',
    marginBottom: '5px',
    fontWeight: 'bold'
  };

  const inputStyle = {
    width: '100%',
    padding: '10px',
    marginBottom: '15px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1em'
  };

  const metricContainerStyle = {
    border: '1px solid #eee',
    padding: '15px',
    marginBottom: '15px',
    borderRadius: '4px'
  };

  const labelColumnStyle = {
    display: 'inline-block',
    width: '120px',
    textAlign: 'left',
    marginRight: '10px',
    fontWeight: 'bold'
  };

  const removeButtonStyle = {
    backgroundColor: 'transparent',
    color: 'inherit',
    border: 'none',
    width: '25px',
    height: '25px',
    fontSize: '18px',
    cursor: 'pointer',
    position: 'absolute',
    top: '10px',
    right: '10px',
    padding: '0'
  };

  const addButtonStyle = {
    width: '100%',
    padding: '12px',
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1em',
    cursor: 'pointer',
    marginBottom: '15px'
  };

  const submitButtonStyle = {
    width: '100%',
    padding: '12px',
    backgroundColor: '#4caf50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1em',
    cursor: 'pointer'
  };

  return (
    <div style={formStyle}>
      <h2 style={titleStyle}>
        Create New Configuration
      </h2>
      
      <form onSubmit={handleSubmit}>
        <div>
          <label 
            htmlFor="config-name"
            style={fieldLabelStyle}>Configuration Name:</label>
          <input
            id="config-name"
            type="text"
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <h3>Metrics</h3>
        
        {metrics.map((metric, index) => (
          <div key={index} style={{...metricContainerStyle, position: 'relative'}}>
            <button
              type="button"
              style={removeButtonStyle}
              onClick={() => removeMetric(index)}
              aria-label="Remove metric"
            >
              ❌
            </button>
            <div style={{ marginBottom: '10px' }}>
              <label 
                htmlFor={`metric-name-${index}`}
                style={labelColumnStyle}>Metric Name:</label>
              <input
                id={`metric-name-${index}`}
                type="text"
                style={{ width: '250px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                value={metric.name}
                onChange={(e) => updateMetric(index, 'name', e.target.value)}
                required
              />
            </div>
            
            <div style={{ marginBottom: '10px' }}>
              <label 
                htmlFor={`expectation-${index}`}
                style={labelColumnStyle}>Expectation:</label>
              <input
                id={`expectation-${index}`}
                type="text"
                style={{ width: '250px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                value={metric.expectation || ''}
                onChange={(e) => updateMetric(index, 'expectation', e.target.value)}
                required
              />
            </div>
            
            <div>
              <label 
                htmlFor={`score-type-${index}`}
                style={labelColumnStyle}>Score Type:</label>
              <select
                id={`score-type-${index}`}
                style={{ width: '250px', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f5f5f5' }}
                value={metric.scoreType}
                onChange={(e) => updateMetric(index, 'scoreType', e.target.value)}
              >
                <option value="numeric">Numeric (1-10)</option>
                <option value="checkbox">Checkbox (Done/Not Done)</option>
              </select>
            </div>
          </div>
        ))}

        <button 
          type="button" 
          style={addButtonStyle}
          onClick={addMetric}
        >
          Add Metric
        </button>

        <button 
          type="submit" 
          style={submitButtonStyle}
          disabled={!name || metrics.some(m => !m.name || !m.expectation)}
        >
          Create Configuration
        </button>

        {message && <p className={message.startsWith("✅") ? "success-message" : "main-message"}>{message}</p>}
      </form>
      
      {/* Modify the form-errors div to be visible when there are errors */}
      <div data-testid="form-errors" style={{ display: Object.keys(errors).length > 0 ? 'block' : 'none' }}>
        {errors.name && <p>{errors.name}</p>}
        {Array.isArray(errors.metrics) && errors.metrics.map((err, idx) => (
          <div key={idx}>
            {err.name && <p>Metric name cannot be empty</p>}
            {err.expectation && <p>Metric expectation cannot be empty</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConfigForm;

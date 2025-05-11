import React, { useState, useCallback } from "react";

const ConfigForm = ({ user }) => {
  const [name, setName] = useState("");
  const [metrics, setMetrics] = useState([{ name: "", expectation: "" }]);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");

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
        const res = await fetch("http://localhost:8080/scoreboard-config", {
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

  const handleAddMetric = useCallback(() => {
    setMetrics((prevMetrics) => [...prevMetrics, { name: "", expectation: "" }]);
  }, []);

  const handleMetricChange = useCallback((index, field, value) => {
    setMetrics((prevMetrics) =>
      prevMetrics.map((metric, i) =>
        i === index ? { ...metric, [field]: value } : metric
      )
    );

    setErrors((prevErrors) => ({
      ...prevErrors,
      metrics: prevErrors.metrics?.map((error, i) =>
        i === index ? { ...error, [field]: "" } : error
      ),
    }));
  }, []);

  const handleRemoveMetric = useCallback((index) => {
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

  return (
    <div className="config-form">
      <h2>Create Config</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="config-name">Name</label>
          <input
            type="text"
            id="config-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {errors.name && <p className="error-message">{errors.name}</p>}
        </div>

        <div>
          <label>Metrics</label>
          {metrics.map((metric, index) => (
            <div key={index} className="metric-item">
              <strong>Metric {index + 1}:</strong>
              <div className="metric-inputs">
                <div>
                  <input
                    type="text"
                    value={metric.name}
                    onChange={(e) => handleMetricChange(index, "name", e.target.value)}
                    placeholder="📝 Name"
                  />
                  {errors.metrics?.[index]?.name && (
                    <p className="error-message">{errors.metrics[index].name}</p>
                  )}
                </div>
                <div>
                  <input
                    type="text"
                    value={metric.expectation}
                    onChange={(e) => handleMetricChange(index, "expectation", e.target.value)}
                    placeholder="🎯 Expectation"
                  />
                  {errors.metrics?.[index]?.expectation && (
                    <p className="error-message">{errors.metrics[index].expectation}</p>
                  )}
                </div>
                {metrics.length > 1 && (
                  <button type="button" onClick={() => handleRemoveMetric(index)} className="remove-metric-button">
                    ❌
                  </button>
                )}
              </div>
            </div>
          ))}

          <button type="button" onClick={handleAddMetric} className="add-metric-button">
            + Add Metric
          </button>
        </div>

        <button type="submit" className="submit-button">Submit Config</button>
      </form>

      {message && <p className={message.startsWith("✅") ? "success-message" : "main-message"}>{message}</p>}
    </div>
  );
};

export default ConfigForm;

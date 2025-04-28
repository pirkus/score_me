import React, { useState } from "react";
import "./App.css"; // Custom CSS for styling

const ConfigForm = () => {
  const [name, setName] = useState("");
  const [metrics, setMetrics] = useState([
    {
      metricName: "",
      expectation: "",
      scorers: [{ id: "", name: "" }],
    },
  ]);

  const handleNameChange = (e) => setName(e.target.value);

  const handleMetricChange = (index, field, value) => {
    const newMetrics = [...metrics];
    newMetrics[index][field] = value;
    setMetrics(newMetrics);
  };

  const handleScorerChange = (metricIndex, scorerIndex, field, value) => {
    const newMetrics = [...metrics];
    newMetrics[metricIndex].scorers[scorerIndex][field] = value;
    setMetrics(newMetrics);
  };

  const handleAddMetric = () => {
    setMetrics([
      ...metrics,
      { metricName: "", expectation: "", scorers: [{ id: "", name: "" }] },
    ]);
  };

  const handleAddScorer = (index) => {
    const newMetrics = [...metrics];
    newMetrics[index].scorers.push({ id: "", name: "" });
    setMetrics(newMetrics);
  };

  const handleRemoveMetric = (index) => {
    const newMetrics = metrics.filter((_, i) => i !== index);
    setMetrics(newMetrics);
  };

  const handleRemoveScorer = (metricIndex, scorerIndex) => {
    const newMetrics = [...metrics];
    newMetrics[metricIndex].scorers = newMetrics[metricIndex].scorers.filter(
      (_, i) => i !== scorerIndex
    );
    setMetrics(newMetrics);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      name,
      metrics: metrics.map((metric) => ({
        name: metric.metricName,
        expectation: metric.expectation,
        scorers: metric.scorers,
      })),
    };

    try {
      const response = await fetch("http://localhost:8080/scoreboards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok) {
        alert(`Config created with ID: ${data.id}`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert("An error occurred while submitting the form");
    }
  };

  return (
    <div className="container">
      <h1>📊 Create Scoreboard Config</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <label>📝 Config Name:</label>
          <input
            type="text"
            value={name}
            onChange={handleNameChange}
            required
            placeholder="Enter config name"
          />
        </div>

        {metrics.map((metric, metricIndex) => (
          <div key={metricIndex} className="form-section">
            <h3>🔢 Metric {metricIndex + 1}</h3>
            <label>📋 Metric Name:</label>
            <input
              type="text"
              value={metric.metricName}
              onChange={(e) =>
                handleMetricChange(metricIndex, "metricName", e.target.value)
              }
              required
              placeholder="Enter metric name"
            />
            <label>📈 Expectation:</label>
            <input
              type="text"
              value={metric.expectation}
              onChange={(e) =>
                handleMetricChange(metricIndex, "expectation", e.target.value)
              }
              required
              placeholder="Enter expectation"
            />

            {metric.scorers.map((scorer, scorerIndex) => (
              <div key={scorerIndex} className="form-section">
                <h4>👤 Scorer {scorerIndex + 1}</h4>
                <label>🏷 Scorer ID:</label>
                <input
                  type="text"
                  value={scorer.id}
                  onChange={(e) =>
                    handleScorerChange(
                      metricIndex,
                      scorerIndex,
                      "id",
                      e.target.value
                    )
                  }
                  required
                  placeholder="Enter scorer ID"
                />
                <label>🧑‍🏫 Scorer Name:</label>
                <input
                  type="text"
                  value={scorer.name}
                  onChange={(e) =>
                    handleScorerChange(
                      metricIndex,
                      scorerIndex,
                      "name",
                      e.target.value
                    )
                  }
                  required
                  placeholder="Enter scorer name"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveScorer(metricIndex, scorerIndex)}
                  className="remove-btn"
                >
                  ❌ Remove Scorer
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => handleAddScorer(metricIndex)}
              className="add-btn"
            >
              ➕ Add Scorer
            </button>
            <button
              type="button"
              onClick={() => handleRemoveMetric(metricIndex)}
              className="remove-btn"
            >
              ❌ Remove Metric
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={handleAddMetric}
          className="add-btn"
        >
          ➕ Add Metric
        </button>

        <div className="submit-btn">
          <button type="submit">📤 Submit</button>
        </div>
      </form>
    </div>
  );
};

export default ConfigForm;

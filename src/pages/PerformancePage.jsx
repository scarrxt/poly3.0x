import { useState, useEffect } from 'react';
import { predictionsAPI, ApiError } from '../api/client';
import './PerformancePage.css';

export default function PerformancePage({ showToast }) {
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchPerformance();
  }, [days]);

  const fetchPerformance = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await predictionsAPI.getPredictionPerformance(days);
      setPerformance(data.performance);
    } catch (err) {
      if (err instanceof ApiError) {
        setError('Unable to load performance data. Please try again.');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="performance-page">
        <div className="loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="performance-page">
        <div className="error-container">
          <h4>Error</h4>
          <p>{error}</p>
          <button className="error-retry-button" onClick={fetchPerformance}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!performance) {
    return (
      <div className="performance-page">
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
            <polyline points="13 2 13 9 20 9"></polyline>
          </svg>
          <h3>No performance data</h3>
          <p>Predictions and their outcomes will appear here</p>
        </div>
      </div>
    );
  }

  const summary = performance.summary || {};
  const winRate = summary.winRate || 0;

  return (
    <div className="performance-page">
      <div className="performance-header">
        <div>
          <h2>Prediction Performance</h2>
          <p className="performance-subtitle">Track prediction accuracy over time</p>
        </div>
        <div className="days-selector">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              className={`days-btn ${days === d ? 'active' : ''}`}
              onClick={() => setDays(d)}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="performance-stats">
        <div className="stat-card">
          <div className="stat-label">Win Rate</div>
          <div className="stat-huge">{winRate.toFixed(1)}%</div>
          <div className="stat-desc">{summary.correctPredictions || 0} of {summary.resolvedPredictions || 0} correct</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Predictions</div>
          <div className="stat-huge">{summary.totalPredictions || 0}</div>
          <div className="stat-desc">
            {summary.resolvedPredictions || 0} resolved, {summary.pendingPredictions || 0} pending
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Correct</div>
          <div className="stat-huge" style={{ color: '#3b6d11' }}>
            {summary.correctPredictions || 0}
          </div>
          <div className="stat-desc">Accurate predictions</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Incorrect</div>
          <div className="stat-huge" style={{ color: '#a32d2d' }}>
            {summary.incorrectPredictions || 0}
          </div>
          <div className="stat-desc">Need improvement</div>
        </div>
      </div>

      <div className="performance-sections">
        <section className="prediction-section">
          <h3>✓ Correct Predictions</h3>
          {performance.correctPredictions && performance.correctPredictions.length > 0 ? (
            <div className="prediction-list">
              {performance.correctPredictions.map((pred) => (
                <div key={pred.id} className="prediction-outcome correct">
                  <div className="outcome-header">
                    <span className="outcome-badge">✓</span>
                    <div className="outcome-info">
                      <h4>{pred.marketTitle}</h4>
                      <p>{pred.option}</p>
                    </div>
                  </div>
                  <div className="outcome-details">
                    <span className="confidence-badge" style={{ background: '#3b6d11' }}>
                      {pred.confidence}% confidence
                    </span>
                    <span className="outcome-date">{new Date(pred.predictionDate).toLocaleDateString()}</span>
                  </div>
                  <a href={pred.polymarketUrl} target="_blank" rel="noopener noreferrer" className="outcome-link">
                    View →
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-results">No correct predictions yet</p>
          )}
        </section>

        <section className="prediction-section">
          <h3>✗ Incorrect Predictions</h3>
          {performance.incorrectPredictions && performance.incorrectPredictions.length > 0 ? (
            <div className="prediction-list">
              {performance.incorrectPredictions.map((pred) => (
                <div key={pred.id} className="prediction-outcome incorrect">
                  <div className="outcome-header">
                    <span className="outcome-badge">✗</span>
                    <div className="outcome-info">
                      <h4>{pred.marketTitle}</h4>
                      <p>Predicted: {pred.predictedAnswer}, Actual: {pred.actualAnswer}</p>
                    </div>
                  </div>
                  <div className="outcome-details">
                    <span className="confidence-badge" style={{ background: '#a32d2d' }}>
                      {pred.confidence}% confidence
                    </span>
                    <span className="outcome-date">{new Date(pred.predictionDate).toLocaleDateString()}</span>
                  </div>
                  <a href={pred.polymarketUrl} target="_blank" rel="noopener noreferrer" className="outcome-link">
                    View →
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-results">No incorrect predictions</p>
          )}
        </section>

        {performance.pendingPredictions && performance.pendingPredictions.length > 0 && (
          <section className="prediction-section">
            <h3>⏳ Pending Resolution</h3>
            <div className="prediction-list">
              {performance.pendingPredictions.map((pred) => (
                <div key={pred.id} className="prediction-outcome pending">
                  <div className="outcome-header">
                    <span className="outcome-badge">⏳</span>
                    <div className="outcome-info">
                      <h4>{pred.marketTitle}</h4>
                      <p>{pred.predictedAnswer}</p>
                    </div>
                  </div>
                  <div className="outcome-details">
                    <span className="confidence-badge" style={{ background: '#854f0b' }}>
                      {pred.confidence}% confidence
                    </span>
                    <span className="outcome-date">{new Date(pred.predictionDate).toLocaleDateString()}</span>
                  </div>
                  <a href={pred.polymarketUrl} target="_blank" rel="noopener noreferrer" className="outcome-link">
                    View →
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

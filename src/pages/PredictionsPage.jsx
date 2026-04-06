import { useState, useEffect } from 'react';
import { predictionsAPI, ApiError } from '../api/client';
import './PredictionsPage.css';

export default function PredictionsPage({ showToast, jumpToMarket }) {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeframe, setTimeframe] = useState('daily');
  const [voted, setVoted] = useState(new Set());
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchPredictions();
  }, [timeframe]);

  useEffect(() => {
    const marketId = String(jumpToMarket?.marketId || '').trim();
    const conditionId = String(jumpToMarket?.conditionId || '').trim();
    const marketTitle = String(jumpToMarket?.title || '').trim().toLowerCase();
    if (!marketId && !conditionId && !marketTitle) return;

    const openMatchingPrediction = async () => {
      try {
        const data = await predictionsAPI.getApprovedPredictions(100, 0, null);
        const list = data?.predictions || [];
        const match = list.find((prediction) => {
          const predictionMarketId = String(prediction.marketId || '').trim();
          const predictionConditionId = String(prediction.conditionId || '').trim();
          const predictionTitle = String(prediction.marketTitle || '').trim().toLowerCase();

          return (
            (marketId && predictionMarketId === marketId) ||
            (conditionId && predictionMarketId === conditionId) ||
            (conditionId && predictionConditionId === conditionId) ||
            (marketId && predictionConditionId === marketId) ||
            (marketTitle && predictionTitle && predictionTitle === marketTitle)
          );
        });

        if (!match) {
          showToast('No approved prediction found for this market yet.', 'info');
          return;
        }

        const matchedTimeframe = match.timeframe || 'daily';
        if (matchedTimeframe !== timeframe) {
          setTimeframe(matchedTimeframe);
        }

        await openPredictionDetail(match);
      } catch {
        showToast('Unable to open the market prediction right now.', 'error');
      }
    };

    openMatchingPrediction();
  }, [jumpToMarket?.token]);

  const fetchPredictions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await predictionsAPI.getApprovedPredictions(50, 0, timeframe);
      setPredictions(data.predictions || []);
    } catch (err) {
      if (err instanceof ApiError) {
        setError('Unable to load predictions. Please try again.');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (predictionId, voteType) => {
    if (voted.has(predictionId)) return;

    try {
      await predictionsAPI.votePrediction(predictionId, voteType);
      setVoted(new Set([...voted, predictionId]));
      showToast(voteType === 'like' ? '👍 Vote recorded!' : '👎 Vote recorded!', 'success');
    } catch {
      showToast('Unable to record vote. Please try again.', 'error');
    }
  };

  const openPredictionDetail = async (prediction) => {
    setSelectedPrediction(prediction);
    setDetailLoading(true);

    try {
      const full = await predictionsAPI.getPredictionById(prediction.id);
      setSelectedPrediction(full);
    } catch {
      // Keep list payload as fallback without exposing technical error details.
      setSelectedPrediction(prediction);
    } finally {
      setDetailLoading(false);
    }
  };

  const closePredictionDetail = () => {
    setSelectedPrediction(null);
    setDetailLoading(false);
  };

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === 'Escape') closePredictionDetail();
    };

    if (selectedPrediction) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', onEscape);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onEscape);
    };
  }, [selectedPrediction]);

  if (loading) {
    return (
      <div className="predictions-page">
        <div className="loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="predictions-page">
      <div className="predictions-header">
        <div>
          <h2>Approved Predictions</h2>
          <p className="predictions-subtitle">AI-powered market analysis</p>
        </div>
        <div className="timeframe-selector">
          {['daily', 'weekly', 'monthly'].map((tf) => (
            <button
              key={tf}
              className={`timeframe-btn ${timeframe === tf ? 'active' : ''}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf.charAt(0).toUpperCase() + tf.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="error-container">
          <h4>Error</h4>
          <p>{error}</p>
          <button className="error-retry-button" onClick={fetchPredictions}>
            Try Again
          </button>
        </div>
      )}

      {!error && predictions.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L15 8H22L17 12L19 18L12 14L5 18L7 12L2 8H9L12 2Z"></path>
          </svg>
          <h3>No predictions yet</h3>
          <p>Check back later for latest predictions</p>
        </div>
      )}

      <div className="predictions-list">
        {predictions.map((pred, index) => (
          <button
            key={pred.id}
            className="prediction-card"
            type="button"
            onClick={() => openPredictionDetail(pred)}
            style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
          >
            <div className="prediction-card-header">
              <div className="prediction-market-info">
                <h3 className="prediction-market-title">
                  {pred.marketTitle || 'Market'}
                </h3>
                <div className="prediction-meta">
                  <span className="timeframe-badge">{pred.timeframe?.toUpperCase()}</span>
                  <span className="confidence-level" data-level={
                    pred.confidence === 'high' ? 'high' :
                    pred.confidence === 'medium' ? 'medium' : 'low'
                  }>
                    {pred.confidence === 'high' ? '🟢 High' : 
                     pred.confidence === 'medium' ? '🟡 Medium' : '🔴 Low'} Confidence
                  </span>
                </div>
              </div>
              <a
                href={pred.polymarketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="market-link-icon"
                onClick={(event) => event.stopPropagation()}
              >
                ↗
              </a>
            </div>

            <div className="prediction-body compact">
              <div className="prediction-recommendation">
                <div className="recommendation-side">
                  <span className="side-label">Choose</span>
                  <span className="side-answer">{pred.recommendedBet}</span>
                </div>
                <div className="recommendation-split">
                  <div className="probability-item">
                    <span className="prob-label">YES</span>
                    <span className="prob-value">{pred.probabilities?.yes ?? 'N/A'}%</span>
                  </div>
                  <div className="probability-item">
                    <span className="prob-label">NO</span>
                    <span className="prob-value">{pred.probabilities?.no ?? 'N/A'}%</span>
                  </div>
                </div>
              </div>

              <p className="prediction-open-hint">Click to view full analysis and reason</p>
            </div>

            <div className="prediction-footer compact">
              <span className="vote-chip">Tap for details</span>
            </div>
          </button>
        ))}
      </div>

      {selectedPrediction && (
        <div className="prediction-modal-overlay" onClick={closePredictionDetail}>
          <div
            className="prediction-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Prediction details"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="prediction-modal-header">
              <div>
                <h3 className="prediction-market-title">
                  {selectedPrediction.marketTitle || 'Prediction details'}
                </h3>
                <div className="prediction-meta">
                  <span className="timeframe-badge">{selectedPrediction.timeframe?.toUpperCase() || 'N/A'}</span>
                  <span className="confidence-level" data-level={
                    selectedPrediction.confidence === 'high' ? 'high' :
                    selectedPrediction.confidence === 'medium' ? 'medium' : 'low'
                  }>
                    {selectedPrediction.confidence === 'high' ? '🟢 High' :
                     selectedPrediction.confidence === 'medium' ? '🟡 Medium' : '🔴 Low'} Confidence
                  </span>
                </div>
              </div>
              <button className="modal-close" type="button" onClick={closePredictionDetail} aria-label="Close details">
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="prediction-modal-loading">
                <div className="loading-spinner"></div>
              </div>
            ) : (
              <>
                <div className="prediction-reason large">
                  <p className="reason-title">Reason & Analysis</p>
                  <p className="reason-text">{selectedPrediction.reason || 'No analysis available yet.'}</p>
                </div>

                <div className="prediction-recommendation">
                  <div className="recommendation-side">
                    <span className="side-label">Best Option</span>
                    <span className="side-answer">{selectedPrediction.recommendedBet || 'N/A'}</span>
                  </div>
                  <div className="recommendation-split">
                    <div className="probability-item">
                      <span className="prob-label">YES</span>
                      <span className="prob-value">{selectedPrediction.probabilities?.yes ?? 'N/A'}%</span>
                    </div>
                    <div className="probability-item">
                      <span className="prob-label">NO</span>
                      <span className="prob-value">{selectedPrediction.probabilities?.no ?? 'N/A'}%</span>
                    </div>
                  </div>
                </div>

                <div className="prediction-disclaimer">
                  <p>💡 <strong>Disclaimer:</strong> We are not responsible for losses and do not control the market. Do your own research.</p>
                </div>

                <div className="prediction-footer">
                  <button
                    className={`vote-btn vote-like ${voted.has(selectedPrediction.id) ? 'disabled' : ''}`}
                    onClick={() => handleVote(selectedPrediction.id, 'like')}
                    disabled={voted.has(selectedPrediction.id)}
                  >
                    👍 Helpful
                  </button>
                  <button
                    className={`vote-btn vote-dislike ${voted.has(selectedPrediction.id) ? 'disabled' : ''}`}
                    onClick={() => handleVote(selectedPrediction.id, 'dislike')}
                    disabled={voted.has(selectedPrediction.id)}
                  >
                    👎 Not Helpful
                  </button>
                  {selectedPrediction.polymarketUrl && (
                    <a
                      href={selectedPrediction.polymarketUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vote-btn open-market-btn"
                    >
                      View Market ↗
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { marketsAPI, predictionsAPI, ApiError } from '../api/client';
import './MarketsPage.css';

const getPolymarketUrl = (market) => {
  if (market?.polymarketUrl) return market.polymarketUrl;
  if (market?.eventSlug) return `https://polymarket.com/event/${encodeURIComponent(market.eventSlug)}`;
  if (market?.slug) return `https://polymarket.com/event/${encodeURIComponent(market.slug)}`;
  return `https://polymarket.com/market/${encodeURIComponent(market?.marketId || market?.conditionId || '')}`;
};

const parseMaybeArray = (value, fallback = []) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();

    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch {
      // Support simple comma-separated values from upstream adapters.
      if (trimmed.includes(',')) {
        return trimmed
          .split(',')
          .map((item) => item.trim().replace(/^"|"$/g, ''))
          .filter(Boolean);
      }

      // Support single scalar values by returning a one-item array.
      if (trimmed.length > 0) {
        return [trimmed.replace(/^"|"$/g, '')];
      }

      return fallback;
    }
  }
  return fallback;
};

const hasCachedPredictions = (market) => {
  if (!market?.cachedPredictions || typeof market.cachedPredictions !== 'object') return false;
  return Object.keys(market.cachedPredictions).length > 0;
};

const marketHasPrediction = (market) => {
  const value = market?.hasPrediction;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', ''].includes(normalized)) return false;
  }
  return hasCachedPredictions(market);
};

const normalizeMarket = (market) => ({
  ...market,
  options: parseMaybeArray(market?.options, ['Yes', 'No']),
  categories: parseMaybeArray(market?.categories, []),
  currentPrices: parseMaybeArray(market?.currentPrices, []),
  hasPrediction: marketHasPrediction(market)
});

const extractMarkets = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.markets)) return payload.markets;
  if (Array.isArray(payload?.data?.markets)) return payload.data.markets;
  return [];
};

const parseNumericPrice = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().replace('%', '');
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) return parsed;

    const fallback = parseFloat(normalized);
    if (Number.isFinite(fallback)) return fallback;
  }
  return NaN;
};

const formatOptionPrice = (value) => {
  const numeric = parseNumericPrice(value);
  if (!Number.isFinite(numeric)) return 'N/A';

  const percent = numeric <= 1 ? numeric * 100 : numeric;
  if (!Number.isFinite(percent)) return 'N/A';

  return `${percent.toFixed(0)}%`;
};

export default function MarketsPage({ onOpenPredictionForMarket }) {
  const [markets, setMarkets] = useState([]);
  const [predictionMarketIds, setPredictionMarketIds] = useState(new Set());
  const [predictionMarketTitles, setPredictionMarketTitles] = useState(new Set());
  const [marketDetailsById, setMarketDetailsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('all'); // 'all' or 'trending'
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [selectedMarketDetails, setSelectedMarketDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    fetchMarkets();
  }, [viewMode]);

  const marketKeys = (market) => {
    const keys = [
      String(market?.marketId || '').trim(),
      String(market?.conditionId || '').trim()
    ].filter(Boolean);
    return [...new Set(keys)];
  };

  const normalizeTitle = (value) => String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const isKnownPredictedMarket = (market) => {
    if (!market) return false;

    const keys = marketKeys(market);
    const titleKey = normalizeTitle(market.title);

    return (
      marketHasPrediction(market) ||
      keys.some((key) => predictionMarketIds.has(key)) ||
      (titleKey && predictionMarketTitles.has(titleKey))
    );
  };

  const fetchMarketDetailsWithFallback = async (market) => {
    const keys = marketKeys(market);
    for (const key of keys) {
      try {
        const detail = await marketsAPI.getMarketById(key);
        return { key, detail };
      } catch {
        // Try next key variant.
      }
    }
    return null;
  };

  const probePredictionAvailability = async (marketList) => {
    const updates = {};

    for (const market of marketList) {
      const keys = marketKeys(market);

      for (const key of keys) {
        try {
          const response = await predictionsAPI.getApprovedPredictionsForMarket(key, 1, 0);
          const count = Number(response?.count ?? 0);
          if (count > 0) {
            updates[key] = true;
            break;
          }
        } catch {
          // Ignore probe failures; rely on primary response signals.
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      setMarkets((prev) => prev.map((market) => {
        const keys = marketKeys(market);
        const inferred = keys.some((key) => updates[key]);
        const titleKey = normalizeTitle(market?.title);
        return {
          ...market,
          hasPrediction:
            marketHasPrediction(market) ||
            inferred ||
            (titleKey && predictionMarketTitles.has(titleKey))
        };
      }));
    }
  };

  const fetchMarkets = async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      if (viewMode === 'trending') {
        data = await marketsAPI.getTrendingMarkets(50);
      } else {
        data = await marketsAPI.getMarkets(50, 0);
      }

      const normalizedMarkets = extractMarkets(data).map(normalizeMarket);

      // Backend now enriches hasPrediction, but this fallback covers temporary sync/index delays.
      let fallbackIds = new Set();
      let fallbackTitles = new Set();
      try {
        // Scan multiple pages because the target market can be outside the first page.
        const allPredictions = [];
        const pageLimit = 100;
        for (let offset = 0; offset <= 400; offset += pageLimit) {
          const predictionData = await predictionsAPI.getApprovedPredictions(pageLimit, offset, null);
          const page = predictionData?.predictions || [];
          allPredictions.push(...page);
          if (page.length < pageLimit) break;
        }

        fallbackIds = new Set(
          allPredictions
            .map((prediction) => String(prediction.marketId || prediction.conditionId || '').trim())
            .filter(Boolean)
        );

        fallbackTitles = new Set(
          allPredictions
            .map((prediction) => normalizeTitle(prediction.marketTitle))
            .filter(Boolean)
        );

        setPredictionMarketIds(fallbackIds);
        setPredictionMarketTitles(fallbackTitles);
      } catch {
        // Ignore fallback fetch failures; markets should still render from primary response.
      }

      setMarkets(
        normalizedMarkets.map((market) => {
          const marketId = String(market.marketId || '').trim();
          const conditionId = String(market.conditionId || '').trim();
          const titleKey = normalizeTitle(market.title);
          const inferredHasPrediction =
            fallbackIds.has(marketId) ||
            fallbackIds.has(conditionId) ||
            (titleKey && fallbackTitles.has(titleKey));

          return {
            ...market,
            hasPrediction: marketHasPrediction(market) || inferredHasPrediction
          };
        })
      );

      // Probe prediction availability per market to avoid stale list-level hasPrediction values.
      probePredictionAvailability(normalizedMarkets);
    } catch (err) {
      if (err instanceof ApiError) {
        setError('Unable to load markets. Please try again.');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      fetchMarkets();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await marketsAPI.searchMarkets(searchQuery);
      const normalized = extractMarkets(data).map(normalizeMarket);
      setMarkets(
        normalized.map((market) => {
          const marketId = String(market.marketId || '').trim();
          const conditionId = String(market.conditionId || '').trim();
          const titleKey = normalizeTitle(market.title);
          return {
            ...market,
            hasPrediction:
              marketHasPrediction(market) ||
              predictionMarketIds.has(marketId) ||
              predictionMarketIds.has(conditionId) ||
              (titleKey && predictionMarketTitles.has(titleKey))
          };
        })
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError('Search failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const openMarketActions = async (market) => {
    setSelectedMarket(market);
    const existingDetail = marketKeys(market).map((key) => marketDetailsById[key]).find(Boolean) || null;
    setSelectedMarketDetails(existingDetail);
    setDetailError('');
    setDetailLoading(!existingDetail);

    if (!existingDetail) {
      try {
        const found = await fetchMarketDetailsWithFallback(market);
        if (found?.detail) {
          setSelectedMarketDetails(found.detail);
          setMarketDetailsById((prev) => ({ ...prev, [found.key]: found.detail }));
        } else {
          setDetailError('Could not load market details. You can still open this market on Polymarket.');
        }
      } finally {
        setDetailLoading(false);
      }
    }
  };

  const closeMarketActions = () => {
    setSelectedMarket(null);
    setSelectedMarketDetails(null);
    setDetailError('');
    setDetailLoading(false);
  };

  if (loading) {
    return (
      <div className="markets-page">
        <div className="loading">
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="markets-page">
      <div className="markets-header">
        <div className="markets-title">
          <h2>Markets</h2>
          <p className="markets-subtitle">Explore Polymarket prediction markets</p>
        </div>
        <div className="markets-controls">
          <form className="search-form" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit">Search</button>
          </form>
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'all' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('all');
                setSearchQuery('');
              }}
            >
              All
            </button>
            <button
              className={`toggle-btn ${viewMode === 'trending' ? 'active' : ''}`}
              onClick={() => {
                setViewMode('trending');
                setSearchQuery('');
              }}
            >
              Trending
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-container">
          <h4>Error</h4>
          <p>{error}</p>
          <button className="error-retry-button" onClick={fetchMarkets}>
            Try Again
          </button>
        </div>
      )}

      {!error && markets.length === 0 && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <h3>No markets found</h3>
          <p>Try adjusting your search or check back later</p>
        </div>
      )}

      <div className="markets-grid">
        {markets.map((market) => (
          <div
            key={market.marketId}
            className="market-card"
            role="button"
            tabIndex={0}
            onClick={() => openMarketActions(market)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openMarketActions(market);
              }
            }}
          >
            <div className="market-card-header">
              <h3 className="market-title">{market.title}</h3>
              {market.categories && market.categories.length > 0 && (
                <div className="market-badges">
                  {market.categories.slice(0, 2).map((cat) => (
                    <span key={cat} className="market-badge">
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="market-status-row">
              <span className={`prediction-status ${marketHasPrediction(market) ? 'has' : 'none'}`}>
                {marketHasPrediction(market) ? 'Prediction available' : 'No prediction yet'}
              </span>
            </div>

            <p className="market-description">
              {market.description ? `${market.description.substring(0, 120)}...` : 'Open on Polymarket to view full market details.'}
            </p>

            <div className="market-stats">
              <div className="stat">
                <span className="stat-label">Liquidity</span>
                <span className="stat-value">${market.liquidity?.toLocaleString()}</span>
              </div>
              <div className="stat">
                <span className="stat-label">24h Volume</span>
                <span className="stat-value">${market.volume24h?.toLocaleString()}</span>
              </div>
              <div className="stat">
                <span className="stat-label">End Date</span>
                <span className="stat-value">
                  {new Date(market.endDate).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="market-options">
              {market.options?.map((opt, idx) => (
                <div key={idx} className="option-row">
                  <span className="option-name">{opt}</span>
                  <span className="option-price">{formatOptionPrice(market.currentPrices?.[idx])}</span>
                </div>
              ))}
            </div>

            <div className="market-footer">
              {marketHasPrediction(market) && (
                <button
                  type="button"
                  className="prediction-link"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (typeof onOpenPredictionForMarket === 'function') {
                      onOpenPredictionForMarket({
                        marketId: market.marketId,
                        conditionId: market.conditionId,
                        title: market.title
                      });
                    }
                  }}
                >
                  View Prediction
                </button>
              )}
              <span className="polymarket-link">Open market options</span>
            </div>
          </div>
        ))}
      </div>

      {selectedMarket && (
        <div className="market-modal-overlay" onClick={closeMarketActions}>
          <div className="market-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="market-modal-header">
              <h3>{selectedMarket.title}</h3>
              <button className="modal-close" type="button" onClick={closeMarketActions} aria-label="Close market details">
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="market-modal-loading">
                <div className="loading-spinner"></div>
              </div>
            ) : (
              <>
                {(() => {
                  const modalHasPrediction =
                    isKnownPredictedMarket(selectedMarket) || isKnownPredictedMarket(selectedMarketDetails);

                  return (
                    <>
                <p className="market-modal-status">
                  {modalHasPrediction
                    ? 'This market has at least one approved prediction.'
                    : 'No approved prediction is currently linked to this market yet.'}
                </p>

                {detailError && <p className="market-modal-error">{detailError}</p>}

                <div className="market-modal-actions">
                  {modalHasPrediction && (
                    <button
                      type="button"
                      className="modal-action prediction"
                      onClick={() => {
                        if (typeof onOpenPredictionForMarket === 'function') {
                          onOpenPredictionForMarket({
                            marketId: selectedMarket.marketId,
                            conditionId: selectedMarket.conditionId,
                            title: selectedMarket.title
                          });
                          closeMarketActions();
                        }
                      }}
                    >
                      View Prediction
                    </button>
                  )}
                  <button
                    type="button"
                    className="modal-action polymarket"
                    onClick={() => {
                      window.open(getPolymarketUrl(selectedMarketDetails || selectedMarket), '_blank', 'noopener,noreferrer');
                    }}
                  >
                    Go to Polymarket ↗
                  </button>
                </div>
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

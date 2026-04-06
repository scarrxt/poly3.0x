import { useState, useEffect } from 'react';
import { adminAPI, ApiError } from '../api/client';
import './AdminPage.css';

export default function AdminPage({ adminAuth, showToast }) {
  const [tab, setTab] = useState('pending'); // 'pending', 'dashboard', 'approved'
  const [predictions, setPredictions] = useState([]);
  const [tabCounts, setTabCounts] = useState({ pending: 0, approved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editProbability, setEditProbability] = useState('');
  const [stats, setStats] = useState(null);
  const [notificationStats, setNotificationStats] = useState(null);

  useEffect(() => {
    if (tab === 'pending' || tab === 'approved') {
      fetchPredictions(tab);
    } else if (tab === 'dashboard') {
      fetchDashboardStats();
    }
  }, [tab]);

  useEffect(() => {
    const preloadCounts = async () => {
      try {
        const [pendingData, approvedData] = await Promise.all([
          adminAPI.getPredictionsForModeration('pending', 1, 0, adminAuth).catch(() => adminAPI.getPredictions('pending', 1, 0, adminAuth)),
          adminAPI.getPredictionsForModeration('approved', 1, 0, adminAuth).catch(() => adminAPI.getPredictions('approved', 1, 0, adminAuth))
        ]);

        setTabCounts({
          pending: Number(pendingData?.total ?? pendingData?.count ?? 0),
          approved: Number(approvedData?.total ?? approvedData?.count ?? 0)
        });
      } catch {
        // Ignore preload errors; tab data fetches still run when tab is opened.
      }
    };

    preloadCounts();
  }, [adminAuth]);

  const fetchPredictions = async (status) => {
    setLoading(true);
    setError(null);
    try {
      let data;
      try {
        data = await adminAPI.getPredictionsForModeration(status, 100, 0, adminAuth);
      } catch {
        data = await adminAPI.getPredictions(status, 100, 0, adminAuth);
      }

      let items = data?.predictions || [];

      // Some deployments may not honor status filtering consistently.
      // Fallback to all predictions and filter client-side when needed.
      if (items.length === 0) {
        try {
          const allData = await adminAPI.getPredictions(null, 200, 0, adminAuth);
          const allItems = allData?.predictions || [];
          const now = Date.now();

          if (status === 'pending') {
            items = allItems.filter((prediction) => {
              if (prediction.status === 'pending') return true;

              // Treat approved-but-not-yet-published records as pending-like for moderation visibility.
              if (prediction.status === 'approved' && prediction.approvedAt) {
                const publishAt = new Date(prediction.approvedAt).getTime();
                return Number.isFinite(publishAt) && publishAt > now;
              }

              return false;
            });
          } else {
            items = allItems.filter((prediction) => prediction.status === status);
          }
        } catch {
          // Keep original items if full-list fallback fails.
        }
      }

      setPredictions(items);
      setTabCounts((prev) => ({
        ...prev,
        [status]: Number(data?.total ?? data?.count ?? items.length)
      }));
    } catch (err) {
      if (err instanceof ApiError) setError(err.message || `Unable to load ${status} predictions`);
      else setError(`Unable to load ${status} predictions. Check backend CORS/admin headers.`);
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, notifications] = await Promise.all([
        adminAPI.getDashboardStats(adminAuth),
        adminAPI.getNotificationStats(adminAuth)
      ]);
      setStats(data);
      setNotificationStats(notifications);
    } catch (err) {
      if (err instanceof ApiError) {
        setError('Unable to load dashboard stats');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCleanupSubscriptions = async () => {
    try {
      const result = await adminAPI.cleanupSubscriptions(adminAuth);
      showToast(`Cleanup done: ${result.push ?? 0} push, ${result.email ?? 0} email`, 'success');
      if (tab === 'dashboard') fetchDashboardStats();
    } catch {
      showToast('Failed to clean subscriptions', 'error');
    }
  };

  const handleApprove = async (predictionId) => {
    try {
      await adminAPI.approvePrediction(predictionId, 'Approved via dashboard', adminAuth);
      showToast('Prediction approved', 'success');
      fetchPredictions(tab);
    } catch {
      showToast('Failed to approve prediction', 'error');
    }
  };

  const handleReject = async (predictionId) => {
    try {
      await adminAPI.rejectPrediction(predictionId, 'Rejected via dashboard', adminAuth);
      showToast('Prediction rejected', 'success');
      fetchPredictions(tab);
    } catch {
      showToast('Failed to reject prediction', 'error');
    }
  };

  const handleEditProbability = async (predictionId) => {
    if (!editProbability || isNaN(editProbability)) {
      showToast('Enter valid probability', 'error');
      return;
    }

    try {
      await adminAPI.editPredictionProbability(predictionId, parseFloat(editProbability), adminAuth);
      showToast('Probability updated', 'success');
      setEditingId(null);
      setEditProbability('');
      fetchPredictions(tab);
    } catch {
      showToast('Failed to update probability', 'error');
    }
  };

  const handleDelete = async (predictionId) => {
    const confirmed = window.confirm('Delete this prediction permanently? This action cannot be undone.');
    if (!confirmed) return;

    try {
      if (tab === 'pending') {
        await adminAPI.deletePendingPrediction(predictionId, adminAuth);
      } else {
        await adminAPI.deleteApprovedPrediction(predictionId, adminAuth);
      }
      showToast('Prediction deleted', 'success');
      fetchPredictions(tab);
    } catch {
      showToast('Failed to delete prediction', 'error');
    }
  };

  const formatDataIssue = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;

    const note = typeof value.note === 'string' ? value.note.trim() : '';
    const code = typeof value.code === 'string' ? value.code.trim() : '';

    if (note && code) return `${note} (${code})`;
    if (note) return note;
    if (code) return code;

    try {
      return JSON.stringify(value);
    } catch {
      return 'Data issue details available';
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h2>Admin Dashboard</h2>
        <div className="admin-tabs">
          <button
            className={`admin-tab ${tab === 'pending' ? 'active' : ''}`}
            onClick={() => setTab('pending')}
          >
            Pending ({tabCounts.pending})
          </button>
          <button
            className={`admin-tab ${tab === 'approved' ? 'active' : ''}`}
            onClick={() => setTab('approved')}
          >
            Approved ({tabCounts.approved})
          </button>
          <button
            className={`admin-tab ${tab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setTab('dashboard')}
          >
            Dashboard
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading">
          <div className="loading-spinner"></div>
        </div>
      )}

      {error && (
        <div className="error-container">
          <h4>Error</h4>
          <p>{error}</p>
          <button className="error-retry-button" onClick={() => {
            if (tab === 'dashboard') {
              fetchDashboardStats();
            } else {
              fetchPredictions(tab);
            }
          }}>
            Try Again
          </button>
        </div>
      )}

      {!loading && tab === 'dashboard' && stats && (
        <AdminDashboard
          stats={stats}
          notificationStats={notificationStats}
          onCleanupSubscriptions={handleCleanupSubscriptions}
        />
      )}

      {!loading && !error && (tab === 'pending' || tab === 'approved') && predictions.length === 0 && (
        <div className="empty-state">
          <h3>No {tab} predictions</h3>
          <p>Check back later</p>
        </div>
      )}

      {!loading && predictions.length > 0 && (
        <div className="admin-predictions">
          {predictions.map((pred) => {
            const predictionId = pred._id || pred.id;
            return (
            <div key={predictionId} className="admin-prediction-card">
              <div className="card-header">
                <h3>{pred.marketTitle || 'Market'}</h3>
                <span className="pred-status" data-status={pred.status}>
                  {pred.status?.toUpperCase()}
                </span>
              </div>

              <div className="card-body">
                <div className="pred-detail">
                  <span className="label">Option:</span>
                  <span>{pred.option}</span>
                </div>
                <div className="pred-detail">
                  <span className="label">Timeframe:</span>
                  <span>{pred.timeframe}</span>
                </div>
                <div className="pred-detail">
                  <span className="label">Market Probability:</span>
                  <span>{pred.marketProbabilityAtTime}%</span>
                </div>
                <div className="pred-detail">
                  <span className="label">AI Probability:</span>
                  <span>{pred.aiProbability}%</span>
                </div>
                <div className="pred-detail">
                  <span className="label">Confidence:</span>
                  <span>{pred.confidence || 'N/A'}</span>
                </div>

                {pred.reason && (
                  <div className="pred-reason">
                    <span className="label">Reason:</span>
                    <p>{pred.reason}</p>
                  </div>
                )}

                {tab === 'pending' && pred.dataIssue && (
                  <div className="pred-reason pred-data-issue">
                    <span className="label">Data Issue:</span>
                    <p>{formatDataIssue(pred.dataIssue)}</p>
                  </div>
                )}

                {tab === 'approved' && (
                  <div className="edit-probability">
                    <label>Edit AI Probability:</label>
                    {editingId === predictionId ? (
                      <div className="edit-form">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={editProbability}
                          onChange={(e) => setEditProbability(e.target.value)}
                          placeholder="0-100"
                        />
                        <button
                          onClick={() => handleEditProbability(predictionId)}
                          className="btn-save"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditProbability('');
                          }}
                          className="btn-cancel"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(predictionId);
                          setEditProbability(String(pred.aiProbability ?? ''));
                        }}
                        className="btn-edit"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {tab === 'pending' && (
                <div className="card-footer">
                  <button
                    className="btn-approve"
                    onClick={() => handleApprove(predictionId)}
                  >
                    Approve
                  </button>
                  <button
                    className="btn-reject"
                    onClick={() => handleReject(predictionId)}
                  >
                    Reject
                  </button>
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(predictionId)}
                  >
                    Delete
                  </button>
                </div>
              )}

              {tab === 'approved' && (
                <div className="card-footer">
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(predictionId)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminDashboard({ stats, notificationStats, onCleanupSubscriptions }) {
  const emailTotal = notificationStats?.email?.total?.[0]?.count ?? 0;
  const emailActive = notificationStats?.email?.active?.[0]?.count ?? 0;
  const emailSent = notificationStats?.email?.totalNotificationsSent?.[0]?.total ?? 0;

  const pushTotal = notificationStats?.push?.total?.[0]?.count ?? 0;
  const pushActive = notificationStats?.push?.active?.[0]?.count ?? 0;
  const pushSent = notificationStats?.push?.totalNotificationsSent?.[0]?.total ?? 0;

  return (
    <div className="admin-dashboard">
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h4>Database Status</h4>
          <p className="status-item">
            {stats.database.connected ? 'Connected' : 'Disconnected'} {stats.database.name ? `(${stats.database.name})` : ''}
          </p>
        </div>

        <div className="dashboard-card">
          <h4>LLM Configuration</h4>
          <p className="status-item">
            {stats.services.llm.configured ? 'Configured' : 'Not configured'} ({stats.services.llm.model || 'N/A'})
          </p>
        </div>

        <div className="dashboard-card">
          <h4>Cache Statistics</h4>
          <p className="stat-value">{stats.cache?.memory?.keys ?? 0} memory keys</p>
          <p className="stat-detail">{stats.cache?.database?.active ?? 0} database active</p>
        </div>

        <div className="dashboard-card">
          <h4>System Uptime</h4>
          <p className="stat-value">{Math.floor((stats.system.uptime || 0) / 3600)}h {Math.floor(((stats.system.uptime || 0) % 3600) / 60)}m</p>
        </div>

        <div className="dashboard-card">
          <h4>Email Notifications</h4>
          <p className="stat-value">{emailActive}/{emailTotal} active</p>
          <p className="stat-detail">{emailSent} total sent</p>
        </div>

        <div className="dashboard-card">
          <h4>Push Notifications</h4>
          <p className="stat-value">{pushActive}/{pushTotal} active</p>
          <p className="stat-detail">{pushSent} total sent</p>
        </div>
      </div>

      <div className="system-info">
        <h4>Model Counts</h4>
        <ul>
          <li>Users: {stats.modelCounts.users}</li>
          <li>Email Subscriptions: {stats.modelCounts.emailSubscriptions}</li>
          <li>Push Subscriptions: {stats.modelCounts.pushSubscriptions}</li>
          <li>Prediction Cache Entries: {stats.modelCounts.predictionCache}</li>
        </ul>
      </div>

      <div className="system-info">
        <h4>Notification Controls</h4>
        <button className="btn-edit" onClick={onCleanupSubscriptions}>Clean Invalid Subscriptions</button>
      </div>
    </div>
  );
}

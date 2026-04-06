/**
 * API Client Service
 * All communication with backend API
 */

const API_BASE = import.meta.env.VITE_API_URL || 'https://polyscope.onrender.com';

const buildAuthHeaders = (auth = null) => {
  if (!auth) return {};
  const headers = {};
  if (auth.adminKey) headers['x-admin-key'] = auth.adminKey;
  if (auth.apiKey) headers['X-API-Key'] = auth.apiKey;
  return headers;
};

class ApiError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

const handleResponse = async (response) => {
  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(
      data?.message || data?.error || 'An error occurred',
      response.status,
      data?.errorCode || data?.code || 'UNKNOWN_ERROR'
    );
  }

  return data?.data ?? null;
};

export const apiClient = {
  async get(endpoint, auth = null) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: buildAuthHeaders(auth)
    });
    return handleResponse(response);
  },

  async post(endpoint, body, auth = null) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...buildAuthHeaders(auth)
      },
      body: JSON.stringify(body)
    });
    return handleResponse(response);
  },

  async patch(endpoint, body, auth = null) {
    const headers = {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(auth)
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body)
    });
    return handleResponse(response);
  },

  async delete(endpoint, auth = null) {
    const headers = buildAuthHeaders(auth);

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE',
      headers
    });
    return handleResponse(response);
  }
};

// Markets API
export const marketsAPI = {
  getMarkets: (limit = 50, offset = 0) =>
    apiClient.get(`/api/markets?limit=${limit}&offset=${offset}`),
  
  getMarketById: (id) =>
    apiClient.get(`/api/markets/${id}`),
  
  searchMarkets: (query) =>
    apiClient.get(`/api/markets/search?q=${encodeURIComponent(query)}`),
  
  getTrendingMarkets: (limit = 10) =>
    apiClient.get(`/api/markets/trending?limit=${limit}`)
};

// Predictions API
export const predictionsAPI = {
  getApprovedPredictions: (limit = 50, offset = 0, timeframe = null) => {
    let url = `/api/predictions?limit=${limit}&offset=${offset}`;
    if (timeframe) url += `&timeframe=${timeframe}`;
    return apiClient.get(url);
  },

  getApprovedPredictionsForMarket: (marketId, limit = 5, offset = 0) =>
    apiClient.get(`/api/predictions?marketId=${encodeURIComponent(marketId)}&limit=${limit}&offset=${offset}`),
  
  getPredictionById: (id) =>
    apiClient.get(`/api/predictions/${id}`),
  
  getPredictionPerformance: (days = 30) =>
    apiClient.get(`/api/predictions/performance?days=${days}`),
  
  votePrediction: (predictionId, voteType) =>
    apiClient.post(`/api/predictions/${predictionId}/vote`, { voteType })
};

// Notifications API
export const notificationsAPI = {
  getVapidPublicKey: () =>
    apiClient.get('/api/notifications/push/vapid-public-key'),
  
  subscribePush: (subscription, markets, preferences) =>
    apiClient.post('/api/notifications/push/subscribe', {
      subscription,
      markets,
      preferences
    }),
  
  subscribeEmail: (email, markets, preferences) =>
    apiClient.post('/api/notifications/email/subscribe', {
      email,
      markets,
      preferences
    }),
  
  verifyEmail: (token) =>
    apiClient.get(`/api/notifications/email/verify?token=${token}`),
  
  unsubscribeEmail: ({ token, email }) =>
    apiClient.post('/api/notifications/email/unsubscribe', {
      ...(token ? { token } : {}),
      ...(email ? { email } : {})
    }),
  
  unsubscribePush: (endpoint) =>
    apiClient.post('/api/notifications/push/unsubscribe', { endpoint })
};

// Admin API
export const adminAPI = {
  getPredictions: (status = null, limit = 50, offset = 0, auth) => {
    let url = `/api/admin/predictions?limit=${limit}&offset=${offset}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    return apiClient.get(url, auth);
  },

  getPredictionsForModeration: (status = 'pending', limit = 50, offset = 0, auth) =>
    apiClient.get(`/api/admin/predictions/status/${status}?limit=${limit}&offset=${offset}`, auth),
  
  approvePrediction: (id, reviewNotes, auth) =>
    apiClient.post(`/api/admin/predictions/${id}/approve`, { reviewNotes }, auth),
  
  rejectPrediction: (id, reviewNotes, auth) =>
    apiClient.post(`/api/admin/predictions/${id}/reject`, { reviewNotes }, auth),
  
  editPredictionProbability: (id, aiProbability, auth) =>
    apiClient.patch(`/api/admin/predictions/${id}/approved/probability`, { aiProbability }, auth),

  deletePendingPrediction: (id, auth) =>
    apiClient.delete(`/api/admin/predictions/${id}/pending`, auth),

  deleteApprovedPrediction: (id, auth) =>
    apiClient.delete(`/api/admin/predictions/${id}/approved`, auth),
  
  getPredictionStats: (auth) =>
    apiClient.get('/api/admin/stats/predictions', auth),

  getNotificationStats: (auth) =>
    apiClient.get('/api/admin/stats/notifications', auth),

  cleanupSubscriptions: (auth) =>
    apiClient.post('/api/admin/cleanup/subscriptions', {}, auth),
  
  getDashboardStats: (auth) =>
    apiClient.get('/api/admin/debug', auth)
};

export { ApiError };

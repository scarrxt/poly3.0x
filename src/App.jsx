import { useState, useEffect } from 'react';
import './App.css';
import Header from './components/layout/Header';
import Navigation from './components/layout/Navigation';
import ErrorBoundary from './components/ErrorBoundary';
import Toast from './components/Toast';
import MarketsPage from './pages/MarketsPage';
import PredictionsPage from './pages/PredictionsPage';
import PerformancePage from './pages/PerformancePage';
import AdminPage from './pages/AdminPage';
import NotificationPage from './pages/NotificationPage';
import EmailVerificationPage from './pages/EmailVerificationPage';

const resolvePageFromLocation = () => {
  const path = window.location.pathname;
  const hash = window.location.hash || '';

  if (path === '/verify-email' || hash.startsWith('#verify-email')) return 'verify-email';
  if (path === '/admin' || hash === '#admin') return 'admin';
  if (path === '/' || path === '') return 'markets';
  return 'not-found';
};

function App() {
  const [currentPage, setCurrentPage] = useState(resolvePageFromLocation);

  const [adminAuth, setAdminAuth] = useState(() => {
    const saved = localStorage.getItem('adminAuth');
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });

  const [toast, setToast] = useState(null);
  const [predictionJump, setPredictionJump] = useState(null);

  useEffect(() => {
    if (adminAuth) localStorage.setItem('adminAuth', JSON.stringify(adminAuth));
    else localStorage.removeItem('adminAuth');
  }, [adminAuth]);

  useEffect(() => {
    const syncRouteAccess = () => {
      setCurrentPage(resolvePageFromLocation());
    };

    const onSecretShortcut = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        setCurrentPage('admin');
      }
    };

    syncRouteAccess();
    window.addEventListener('hashchange', syncRouteAccess);
    window.addEventListener('popstate', syncRouteAccess);
    window.addEventListener('keydown', onSecretShortcut);

    return () => {
      window.removeEventListener('hashchange', syncRouteAccess);
      window.removeEventListener('popstate', syncRouteAccess);
      window.removeEventListener('keydown', onSecretShortcut);
    };
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const handleNavigate = (page) => {
    setCurrentPage(page);
    if (window.location.pathname !== '/' || window.location.hash) {
      window.history.replaceState({}, '', '/');
    }
  };

  const handleOpenPredictionForMarket = (market) => {
    const normalized = typeof market === 'string' ? { marketId: market } : (market || {});
    setPredictionJump({ ...normalized, token: Date.now() });
    setCurrentPage('predictions');
    if (window.location.pathname !== '/' || window.location.hash) {
      window.history.replaceState({}, '', '/');
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'markets':
        return <MarketsPage onOpenPredictionForMarket={handleOpenPredictionForMarket} />;
      case 'predictions':
        return <PredictionsPage showToast={showToast} jumpToMarket={predictionJump} />;
      case 'performance':
        return <PerformancePage showToast={showToast} />;
      case 'notifications':
        return <NotificationPage showToast={showToast} />;
      case 'admin':
        return adminAuth ? (
          <AdminPage adminAuth={adminAuth} showToast={showToast} />
        ) : (
          <AdminLoginPage setAdminAuth={setAdminAuth} showToast={showToast} setCurrentPage={handleNavigate} />
        );
      case 'verify-email':
        return <EmailVerificationPage showToast={showToast} />;
      case 'not-found':
        return <NotFoundPage onBackToMarkets={() => handleNavigate('markets')} />;
      default:
        return <MarketsPage />;
    }
  };

  const hideNavigation = currentPage === 'verify-email';

  return (
    <ErrorBoundary showToast={showToast}>
      <div className="app">
        <Header
          onLogout={() => {
            setAdminAuth(null);
            handleNavigate('markets');
          }}
          isAdmin={!!adminAuth}
        />
        <Navigation
          currentPage={currentPage}
          onNavigate={handleNavigate}
          isAdmin={!!adminAuth}
          hideAll={hideNavigation}
        />
        <main className="app-main">
          {renderPage()}
        </main>
        {toast && <Toast message={toast.message} type={toast.type} />}
      </div>
    </ErrorBoundary>
  );
}

function NotFoundPage({ onBackToMarkets }) {
  return (
    <div className="not-found-page">
      <div className="not-found-card">
        <h2>Page Not Found</h2>
        <p>The page you requested does not exist in this app.</p>
        <button type="button" onClick={onBackToMarkets}>Back to Markets</button>
      </div>
    </div>
  );
}

function AdminLoginPage({ setAdminAuth, showToast, setCurrentPage }) {
  const [adminKey, setAdminKey] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'https://polyscope.onrender.com';
      const response = await fetch(`${apiBase}/api/admin/debug`, {
        headers: {
          'x-admin-key': adminKey,
          'X-API-Key': apiKey
        }
      });

      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (response.ok) {
        setAdminAuth({ adminKey, apiKey });
        showToast('Admin access granted', 'success');
        setCurrentPage('admin');
      } else {
        const serverMessage = payload?.message || payload?.error || 'Invalid admin credentials';
        setLoginError(serverMessage);
        showToast(serverMessage, 'error');
      }
    } catch (error) {
      const rawMessage = String(error?.message || '').toLowerCase();
      const message =
        rawMessage.includes('failed to fetch') || rawMessage.includes('networkerror')
          ? 'Admin login blocked by backend CORS. Backend must allow x-admin-key in Access-Control-Allow-Headers.'
          : 'Unable to verify admin credentials';
      setLoginError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <h2>Admin Access</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Enter admin secret key (x-admin-key)"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            disabled={loading}
            required
          />
          <input
            type="password"
            placeholder="Enter API key (X-API-Key)"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={loading}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Login'}
          </button>
        </form>
        {loginError && <p className="admin-login-hint">{loginError}</p>}
        <p className="admin-login-hint">Enter both credentials required by backend admin routes</p>
        <p className="admin-login-hint">Use `ADMIN_SECRET_KEY` as x-admin-key and `ADMIN_API_KEY` as X-API-Key from backend env.</p>
        <p className="admin-login-hint">If browser says CORS/Failed to fetch, backend must include x-admin-key in CORS allowed headers.</p>
      </div>
    </div>
  );
}

export default App;

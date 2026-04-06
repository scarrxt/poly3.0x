import './Navigation.css';

export default function Navigation({ currentPage, onNavigate, isAdmin, hideAll = false }) {
  if (hideAll) return null;

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-links">
          <button
            className={`nav-link ${currentPage === 'markets' ? 'active' : ''}`}
            onClick={() => onNavigate('markets')}
          >
            Markets
          </button>
          <button
            className={`nav-link ${currentPage === 'predictions' ? 'active' : ''}`}
            onClick={() => onNavigate('predictions')}
          >
            Predictions
          </button>
          <button
            className={`nav-link ${currentPage === 'performance' ? 'active' : ''}`}
            onClick={() => onNavigate('performance')}
          >
            Performance
          </button>
          <button
            className={`nav-link ${currentPage === 'notifications' ? 'active' : ''}`}
            onClick={() => onNavigate('notifications')}
          >
            Alerts
          </button>
          {isAdmin && (
            <button
              className={`nav-link admin ${currentPage === 'admin' ? 'active' : ''}`}
              onClick={() => onNavigate('admin')}
            >
              Admin
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

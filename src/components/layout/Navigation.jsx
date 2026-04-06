import './Navigation.css';
import { useEffect, useState } from 'react';

export default function Navigation({ currentPage, onNavigate, isAdmin, hideAll = false, className = '' }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [currentPage]);

  function handleNavigate(page) {
    onNavigate(page);
    setIsMobileMenuOpen(false);
  }

  if (hideAll) return null;

  return (
    <nav className={`navigation ${className}`.trim()}>
      <div className="nav-container">
        <button
          type="button"
          className={`nav-toggle ${isMobileMenuOpen ? 'open' : ''}`}
          aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={isMobileMenuOpen}
          aria-controls="primary-navigation"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
        >
          <span className="nav-toggle-line" />
          <span className="nav-toggle-line" />
          <span className="nav-toggle-line" />
        </button>

        <div id="primary-navigation" className={`nav-links ${isMobileMenuOpen ? 'open' : ''}`}>
          <button
            className={`nav-link ${currentPage === 'markets' ? 'active' : ''}`}
            onClick={() => handleNavigate('markets')}
          >
            Markets
          </button>
          <button
            className={`nav-link ${currentPage === 'predictions' ? 'active' : ''}`}
            onClick={() => handleNavigate('predictions')}
          >
            Predictions
          </button>
          <button
            className={`nav-link ${currentPage === 'performance' ? 'active' : ''}`}
            onClick={() => handleNavigate('performance')}
          >
            Performance
          </button>
          <button
            className={`nav-link ${currentPage === 'notifications' ? 'active' : ''}`}
            onClick={() => handleNavigate('notifications')}
          >
            Alerts
          </button>
          {isAdmin && (
            <button
              className={`nav-link admin ${currentPage === 'admin' ? 'active' : ''}`}
              onClick={() => handleNavigate('admin')}
            >
              Admin
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

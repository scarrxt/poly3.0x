import './Header.css';
import Navigation from './Navigation';

export default function Header({ onLogout, isAdmin, currentPage, onNavigate, hideNavigation }) {
  return (
    <header className="header">
      <div className="header-container">
        <div className="header-brand">
          <h1 className="header-title">POLY<span>SCOPE</span></h1>
        </div>
        <Navigation
          currentPage={currentPage}
          onNavigate={onNavigate}
          isAdmin={isAdmin}
          hideAll={hideNavigation}
          className="inline"
        />
        {isAdmin && (
          <button className="header-logout" onClick={onLogout} type="button">
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}

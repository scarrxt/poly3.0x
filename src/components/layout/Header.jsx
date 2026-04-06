import './Header.css';

export default function Header({ onLogout, isAdmin }) {
  return (
    <header className="header">
      <div className="header-container">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 className="header-title">POLY<span>SCOPE</span></h1>
          <p className="header-subtitle">Prediction Intelligence</p>
        </div>
        {isAdmin && (
          <button className="header-logout" onClick={onLogout} type="button">
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}

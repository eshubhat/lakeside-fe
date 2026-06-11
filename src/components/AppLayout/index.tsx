import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV_ITEMS = [
  { icon: 'dashboard', label: 'Dashboard', href: '/' },
  { icon: 'videocam', label: 'New Room', href: '/room' },
  { icon: 'movie_edit', label: 'Video Editor', href: '/editor' },
  { icon: 'history', label: 'History', href: '/history' },
];

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleStartInstant = () => navigate('/room');

  return (
    <div className="home-layout">
      {/* ── Left Sidebar ─────────────────────────────────────────────── */}
      <aside className="home-sidebar">
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
          <div style={{
            width: '40px', height: '40px', background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--vibrant-lime)', fontVariationSettings: "'FILL' 1" }}>
              signal_cellular_alt
            </span>
          </div>
          <div>
            <h1 className="type-headline-md" style={{ fontSize: '24px' }}>Lakeside</h1>
            <p className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px' }}>Enterprise Video</p>
          </div>
        </div>

        {/* Primary CTA — goes to lobby */}
        <button
          id="new-meeting-btn"
          onClick={handleStartInstant}
          className="btn-action"
          style={{ marginBottom: '32px', width: '100%', padding: '16px', justifyContent: 'center' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
          New Meeting
        </button>

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {NAV_ITEMS.map((item) => {
            const active = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
            return (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  if (item.href !== '#') navigate(item.href);
                }}
                className={`sidebar-nav-item${active ? ' active' : ''}`}
              >
                <span className="material-symbols-outlined" style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>
                  {item.icon}
                </span>
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Bottom nav */}
        <div style={{ marginTop: 'auto', paddingTop: '32px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <a href="#" className="sidebar-nav-item">
            <span className="material-symbols-outlined">help</span>Help
          </a>
          <button
            id="logout-btn"
            onClick={logout}
            className="sidebar-nav-item"
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <span className="material-symbols-outlined">logout</span>Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────── */}
      <main className="home-main">
        {children}
      </main>

      {/* ── Mobile Bottom Navigation ───────────────────────────────────── */}
      <nav className="mobile-bottom-nav">
        <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className={`mobile-nav-item ${location.pathname === '/' ? 'active' : ''}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname === '/' ? "'FILL' 1" : "'FILL' 0" }}>dashboard</span>
          Dashboard
        </a>
        <a href="/history" onClick={(e) => { e.preventDefault(); navigate('/history'); }} className={`mobile-nav-item ${location.pathname.startsWith('/history') ? 'active' : ''}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname.startsWith('/history') ? "'FILL' 1" : "'FILL' 0" }}>history</span>
          History
        </a>
        
        {/* Floating Action Button for New Meeting */}
        <button onClick={handleStartInstant} className="mobile-nav-fab" aria-label="New Meeting">
          <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>add</span>
        </button>
        
        <a href="/editor" onClick={(e) => { e.preventDefault(); navigate('/editor'); }} className={`mobile-nav-item ${location.pathname.startsWith('/editor') ? 'active' : ''}`}>
          <span className="material-symbols-outlined" style={{ fontVariationSettings: location.pathname.startsWith('/editor') ? "'FILL' 1" : "'FILL' 0" }}>movie_edit</span>
          Editor
        </a>
        <button onClick={logout} className="mobile-nav-item" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <span className="material-symbols-outlined">logout</span>
          Sign Out
        </button>
      </nav>
    </div>
  );
};

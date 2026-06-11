import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';


const NAV_ITEMS = [
  { icon: 'dashboard', label: 'Dashboard', active: true, href: '/' },
  { icon: 'videocam', label: 'New Room', active: false, href: '/room' },
  { icon: 'movie_edit', label: 'Video Editor', active: false, href: '/editor' },
  // { icon: 'video_library', label: 'Library',   active: false, href: '#' },
  { icon: 'history', label: 'History', active: false, href: '/history' },
];

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [roomInput, setRoomInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Goes to lobby (/room) which generates a new room ID
  const handleStartInstant = () => navigate('/room');

  // Joins an existing room directly by ID → VideoCall
  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomInput.trim()) navigate(`/room/${roomInput.trim()}`);
  };

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
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                if (item.href !== '#') navigate(item.href);
              }}
              className={`sidebar-nav-item${item.active ? ' active' : ''}`}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: item.active ? "'FILL' 1" : "'FILL' 0" }}>
                {item.icon}
              </span>
              {item.label}
            </a>
          ))}
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
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '64px' }}>
          <div>
            <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'block', marginBottom: '8px' }}>
              Workspace / Create
            </span>
            <h2 className="type-display-lg" style={{ letterSpacing: '-0.02em' }}>
              Start a Session
            </h2>
          </div>
          <div style={{ position: 'relative' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <div className="profile-info-text" style={{ textAlign: 'right' }}>
                <p className="type-button" style={{ color: 'var(--primary)' }}>{user?.name || 'User'}</p>
                <p className="type-label-sm" style={{ color: 'var(--on-surface-variant)' }}>{user?.email || 'Member'}</p>
              </div>
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                overflow: 'hidden', border: '1px solid var(--primary)', padding: '2px',
                background: 'var(--surface-container-high)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-headline)', fontSize: '18px', fontWeight: 600,
              }}>
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>

            {showDropdown && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                background: 'var(--surface)', border: '1px solid var(--border-subtle)',
                borderRadius: '8px', padding: '8px', zIndex: 10, minWidth: '150px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}>
                <div className="profile-dropdown-mobile-info" style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '8px' }}>
                  <p className="type-button" style={{ color: 'var(--primary)' }}>{user?.name || 'User'}</p>
                  <p className="type-label-sm" style={{ color: 'var(--on-surface-variant)' }}>{user?.email || 'Member'}</p>
                </div>
                <button
                  onClick={logout}
                  style={{
                    width: '100%', padding: '8px 16px', background: 'none', border: 'none',
                    display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
                    color: 'var(--error)', fontFamily: 'var(--font-button)', fontSize: '14px',
                    justifyContent: 'flex-start'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'var(--surface-container)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Bento Grid */}
        <div className="home-bento-grid">
          {/* Instant Meeting (7/12) */}
          <div className="home-bento-instant">
            <HoverCard height="400px" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
              <div aria-hidden style={{ position: 'absolute', top: 0, right: 0, padding: '32px', opacity: 0.08, pointerEvents: 'none' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '160px' }}>bolt</span>
              </div>
              <div style={{ zIndex: 1 }}>
                <div style={{
                  width: '48px', height: '48px', background: 'var(--vibrant-lime)',
                  border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '32px',
                }}>
                  <span className="material-symbols-outlined">play_arrow</span>
                </div>
                <h3 className="type-headline-lg" style={{ marginBottom: '16px' }}>Start an Instant Meeting</h3>
                <p className="type-body-lg" style={{ color: 'var(--on-surface-variant)', maxWidth: '400px' }}>
                  Launch a secure, high-definition room immediately. Perfect for quick syncs and ad-hoc collaboration.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 1 }}>
                <button
                  id="start-now-btn"
                  onClick={handleStartInstant}
                  className="btn-primary"
                  style={{ padding: '16px 32px' }}
                >
                  Start Now
                </button>
                <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>
                  NO RESERVATION REQUIRED
                </span>
              </div>
            </HoverCard>
          </div>

          {/* Join / Schedule (5/12) */}
          <div className="home-bento-join">
            <HoverCard height="400px" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{
                  width: '48px', height: '48px', background: '#fff',
                  border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '32px',
                }}>
                  <span className="material-symbols-outlined">calendar_today</span>
                </div>
                <h3 className="type-headline-lg" style={{ marginBottom: '16px' }}>Join a Room</h3>
                <p className="type-body-md" style={{ color: 'var(--on-surface-variant)' }}>
                  Enter a room ID shared by the host to join an existing session instantly.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <form onSubmit={handleJoinRoom} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ borderBottom: '1px solid var(--primary)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <input
                      id="room-id-input"
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value)}
                      placeholder="Enter room ID…"
                      className="type-label-sm"
                      style={{
                        background: 'none', border: 'none', outline: 'none',
                        fontFamily: 'var(--font-label)', fontSize: '12px',
                        letterSpacing: '0.05em', width: '100%',
                        color: 'var(--on-surface)',
                      }}
                    />
                    <span className="material-symbols-outlined" style={{ color: 'var(--on-surface-variant)', fontSize: '20px' }}>meeting_room</span>
                  </div>
                  <button
                    id="join-room-btn"
                    type="submit"
                    className="btn-secondary"
                    style={{ width: '100%', padding: '16px', justifyContent: 'center' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>login</span>
                    Join Room
                  </button>
                </form>
              </div>
            </HoverCard>
          </div>

          {/* Recent Rooms (4/12) */}
          {/* <div style={{ gridColumn: 'span 4' }}>
            <HoverCard style={{ padding: '32px' }}>
              <h4 className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px' }}>
                RECENT ROOMS
              </h4>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[{ name: 'Product Sync', time: '2 hours ago' }, { name: 'Design Review', time: 'Yesterday' }].map((r) => (
                  <li key={r.name} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid var(--surface-container)', paddingBottom: '8px',
                    cursor: 'pointer',
                  }}>
                    <div>
                      <p className="type-button" style={{ color: 'var(--primary)' }}>{r.name}</p>
                      <p className="type-label-sm" style={{ color: 'var(--on-surface-variant)', fontSize: '11px' }}>{r.time}</p>
                    </div>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--on-surface-variant)' }}>history</span>
                  </li>
                ))}
              </ul>
            </HoverCard>
          </div> */}

          {/* Feature Banner (8/12) */}
          <div className="home-bento-feature">
            <div style={{
              background: 'var(--primary)', color: '#fff',
              padding: '32px', border: '1px solid var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              overflow: 'hidden', position: 'relative',
              cursor: 'pointer',
            }}>
              <div aria-hidden style={{
                position: 'absolute', top: 0, right: 0,
                width: '256px', height: '256px',
                border: '40px solid rgba(166,228,46,0.1)',
                borderRadius: '50%', marginRight: '-80px', marginTop: '-80px',
                pointerEvents: 'none',
              }} />
              <div style={{ maxWidth: '500px', zIndex: 1 }}>
                <span style={{
                  display: 'inline-block', background: 'var(--vibrant-lime)',
                  color: 'var(--primary)', padding: '4px 12px',
                  fontFamily: 'var(--font-label)', fontSize: '10px', fontWeight: 500,
                  letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '16px',
                }}>NEW FEATURE</span>
                <h4 className="type-headline-lg" style={{ marginBottom: '8px', color: '#fff' }}>Immersive Screen Share</h4>
                <p className="type-body-md" style={{ color: 'var(--surface-variant)' }}>
                  Zero-latency 4K screen sharing with integrated spatial audio and real-time annotation tools.
                </p>
              </div>
              <button className="btn-secondary" style={{ zIndex: 1, background: '#fff', color: 'var(--primary)', flexShrink: 0 }}>
                LEARN MORE
              </button>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <footer style={{ marginTop: '64px', display: 'flex', alignItems: 'center', gap: '32px', padding: '24px 0', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--vibrant-lime)' }} />
            <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>SYSTEMS OPERATIONAL</span>
          </div>
          <div style={{ marginLeft: 'auto' }}>
            <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>v0.2.0</span>
          </div>
        </footer>
      </main>

      {/* ── Mobile Bottom Navigation ───────────────────────────────────── */}
      <nav className="mobile-bottom-nav">
        <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} className="mobile-nav-item active">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>dashboard</span>
          Dashboard
        </a>
        <a href="/history" onClick={(e) => { e.preventDefault(); navigate('/history'); }} className="mobile-nav-item">
          <span className="material-symbols-outlined">history</span>
          History
        </a>
        
        {/* Floating Action Button for New Meeting */}
        <button onClick={handleStartInstant} className="mobile-nav-fab" aria-label="New Meeting">
          <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>add</span>
        </button>
        
        <a href="/editor" onClick={(e) => { e.preventDefault(); navigate('/editor'); }} className="mobile-nav-item">
          <span className="material-symbols-outlined">movie_edit</span>
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

const HoverCard: React.FC<{
  children: React.ReactNode;
  height?: string;
  style?: React.CSSProperties;
}> = ({ children, height, style = {} }) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        background: 'var(--surface-container-lowest)',
        border: hovered ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
        padding: '40px',
        height: height || 'auto',
        // Disable transform transition while pressed so clicking doesn't trigger the lift animation
        transition: pressed ? 'border-color 0.2s, box-shadow 0.3s' : 'transform 0.3s, border-color 0.2s, box-shadow 0.3s',
        transform: hovered && !pressed ? 'translateY(-4px)' : 'none',
        boxShadow: hovered && !pressed ? '0 12px 30px -4px rgba(0,0,0,0.08)' : 'none',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export default Home;

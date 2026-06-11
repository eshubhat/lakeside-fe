import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';


const RoomEntry: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Generate a stable room ID for this lobby session
  const [roomId] = useState(() => Math.random().toString(36).slice(2, 9));
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [toastDismissed, setToastDismissed] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudio, setSelectedAudio] = useState<string>('');
  const [selectedVideo, setSelectedVideo] = useState<string>('');

  // Network
  const [networkStatus, setNetworkStatus] = useState('CHECKING...');
  const [networkColor, setNetworkColor] = useState('var(--vibrant-lime)');

  useEffect(() => {
    const checkNetwork = () => {
      const conn = (navigator as any).connection;
      if (conn && typeof conn.downlink === 'number') {
        const mbps = conn.downlink;
        if (mbps >= 10) {
          setNetworkStatus('EXCELLENT');
          setNetworkColor('var(--vibrant-lime)'); // green
        } else if (mbps >= 5) {
          setNetworkStatus('DECENT');
          setNetworkColor('#FFC107'); // yellow
        } else {
          setNetworkStatus('BAD');
          setNetworkColor('var(--error)'); // red
        }
      } else if (conn) {
        // Fallback if downlink is unavailable but effectiveType is
        if (conn.effectiveType === '4g') {
          setNetworkStatus('EXCELLENT');
          setNetworkColor('var(--vibrant-lime)');
        } else if (conn.effectiveType === '3g') {
          setNetworkStatus('DECENT');
          setNetworkColor('#FFC107');
        } else {
          setNetworkStatus('BAD');
          setNetworkColor('var(--error)');
        }
      } else {
        setNetworkStatus('ONLINE');
        setNetworkColor('var(--vibrant-lime)');
      }
    };
    checkNetwork();
    
    const conn = (navigator as any).connection;
    if (conn) conn.addEventListener('change', checkNetwork);

    const handleOffline = () => {
      setNetworkStatus('OFFLINE');
      setNetworkColor('var(--error)');
    };

    window.addEventListener('online', checkNetwork);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      if (conn) conn.removeEventListener('change', checkNetwork);
      window.removeEventListener('online', checkNetwork);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (showSettings) {
      navigator.mediaDevices.enumerateDevices().then(allDevices => {
        setDevices(allDevices);
        if (!selectedAudio) {
          const audio = allDevices.find(d => d.kind === 'audioinput');
          if (audio) setSelectedAudio(audio.deviceId);
        }
        if (!selectedVideo) {
          const video = allDevices.find(d => d.kind === 'videoinput');
          if (video) setSelectedVideo(video.deviceId);
        }
      }).catch(() => {});
    }
  }, [showSettings, selectedAudio, selectedVideo]);

  const inviteLink = `${window.location.origin}/room/${roomId}`;

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(inviteLink); }
    catch {
      const el = document.createElement('textarea');
      el.value = inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Navigate to the actual call — /room/:roomId → VideoCall
  const handleJoin = () => navigate(`/room/${roomId}`);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface-container-lowest)',
        borderBottom: '1px solid var(--border-subtle)',
        height: '80px',
      }}>
        <div style={{
          maxWidth: 'var(--container-max)', margin: '0 auto',
          padding: '0 40px', height: '100%',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div className="type-display-lg" style={{ fontSize: '28px', cursor: 'pointer' }} onClick={() => navigate('/')}>
            Lakeside
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
              <span className="material-symbols-outlined">settings</span>
            </button>
            <button
              onClick={logout}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}
              title="Sign out"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%',
              background: 'var(--surface-gray)', overflow: 'hidden',
              border: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-label)', fontSize: '12px', fontWeight: 600,
            }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <main style={{
        flex: 1, display: 'flex',
        height: 'calc(100vh - 80px)',
        maxWidth: 'var(--container-max)', margin: '0 auto', width: '100%',
      }}>
        {/* Left sidebar — meeting details */}
        <aside style={{
          width: '320px', minWidth: '320px',
          borderRight: '1px solid var(--border-subtle)',
          background: 'var(--surface-container-lowest)',
          padding: '40px',
          display: 'flex', flexDirection: 'column', gap: '32px',
          overflowY: 'auto',
        }}>
          <div>
            <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
              READY TO JOIN
            </span>
            <h1 className="type-headline-lg" style={{ marginBottom: '16px' }}>
              Room: <span style={{ fontFamily: 'var(--font-label)', letterSpacing: '0.05em' }}>{roomId}</span>
            </h1>
            <p className="type-body-md" style={{ color: 'var(--on-surface-variant)' }}>
              Share the link below to invite others to this room.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Host info */}
            <div>
              <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)', display: 'block', marginBottom: '12px', textTransform: 'uppercase' }}>
                HOST
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontFamily: 'var(--font-label)', fontSize: '14px', fontWeight: 600,
                }}>
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="type-button" style={{ color: 'var(--primary)' }}>{user?.name || 'You'}</p>
                  <p className="type-label-sm" style={{ color: 'var(--on-surface-variant)', fontSize: '11px' }}>Host</p>
                </div>
              </div>
            </div>

            {/* Network status */}
            <div style={{
              padding: '16px', background: 'var(--surface-container)',
              border: '1px solid var(--border-subtle)',
            }}>
              <span className="type-label-sm" style={{ color: 'var(--primary)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                NETWORK STATUS
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: networkColor,
                }} />
                <span className="type-label-sm">{networkStatus}</span>
              </div>
            </div>

            {/* Room link */}
            <div style={{
              padding: '16px',
              background: 'var(--surface-container)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
            }}>
              <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>
                ROOM LINK
              </span>
              <p className="type-label-sm" style={{
                color: 'var(--on-surface)',
                fontSize: '11px',
                wordBreak: 'break-all',
                marginBottom: '12px',
              }}>
                {inviteLink}
              </p>
              <button
                onClick={copyLink}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '11px', width: '100%', justifyContent: 'center' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  {linkCopied ? 'check_circle' : 'content_copy'}
                </span>
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>

          {/* Share shortcut */}
          <div style={{ marginTop: 'auto', paddingTop: '32px', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              onClick={copyLink}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: linkCopied ? 'var(--vibrant-lime)' : 'var(--on-surface-variant)',
                fontFamily: 'var(--font-button)', fontSize: '14px', fontWeight: 600,
              }}
            >
              <span className="material-symbols-outlined">{linkCopied ? 'check_circle' : 'share'}</span>
              {linkCopied ? 'Copied!' : 'Share Invite Link'}
            </button>
          </div>
        </aside>

        {/* Right main — camera preview */}
        <section style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '40px', background: 'var(--surface-gray)', position: 'relative',
        }}>
          {/* Atmospheric lime glow */}
          <div aria-hidden style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: '600px', height: '600px',
              background: 'rgba(166,228,46,0.1)',
              filter: 'blur(120px)',
              borderRadius: '50%',
            }} />
          </div>

          <div style={{ width: '100%', maxWidth: '720px', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '48px' }}>
            {/* Camera preview tile */}
            <div style={{
              width: '100%',
              aspectRatio: '16/9',
              background: 'var(--video-placeholder)',
              border: '1px solid var(--primary)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Preview badge */}
              <div style={{
                position: 'absolute', top: '24px', right: '24px', zIndex: 2,
                background: 'var(--primary)', padding: '4px 12px',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--vibrant-lime)' }} />
                <span className="type-label-sm" style={{ color: '#fff', textTransform: 'uppercase' }}>PREVIEW</span>
              </div>

              {/* Camera off state */}
              {!camOn && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: '16px',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--vibrant-lime)' }}>videocam_off</span>
                  <h3 className="type-headline-lg" style={{ color: '#fff', fontSize: '24px' }}>Camera is off</h3>
                  <p className="type-body-md" style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', maxWidth: '280px' }}>
                    Click the camera button below to enable your webcam.
                  </p>
                </div>
              )}

              {/* Camera on — avatar placeholder (real video needs MediaStream) */}
              {camOn && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--primary-container)',
                }}>
                  <div style={{
                    width: '96px', height: '96px', borderRadius: '50%',
                    border: '2px solid var(--vibrant-lime)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-headline)', fontSize: '36px', fontWeight: 700,
                    color: '#fff',
                  }}>
                    {user?.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                </div>
              )}

              {/* Bottom controls overlay */}
              <div style={{
                position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: '16px',
                background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.2)', padding: '8px', borderRadius: '9999px',
              }}>
                {/* Mic */}
                <button
                  onClick={() => setMicOn(!micOn)}
                  title={micOn ? 'Mute microphone' : 'Unmute microphone'}
                  style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: micOn ? '#fff' : 'var(--primary)',
                    color: micOn ? 'var(--primary)' : '#fff',
                    border: '1px solid var(--primary)',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  <span className="material-symbols-outlined">{micOn ? 'mic' : 'mic_off'}</span>
                </button>
                {/* Camera */}
                <button
                  onClick={() => setCamOn(!camOn)}
                  title={camOn ? 'Turn off camera' : 'Turn on camera'}
                  style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: camOn ? '#fff' : 'var(--primary)',
                    color: camOn ? 'var(--primary)' : '#fff',
                    border: '1px solid var(--primary)',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  <span className="material-symbols-outlined">{camOn ? 'videocam' : 'videocam_off'}</span>
                </button>
                <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.2)', margin: '0 8px' }} />
                {/* Settings */}
                <button onClick={() => setShowSettings(true)} style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#fff', color: 'var(--primary)',
                  border: '1px solid var(--primary)', cursor: 'pointer',
                }}>
                  <span className="material-symbols-outlined">settings</span>
                </button>
              </div>
            </div>

            {/* CTA section */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', width: '100%' }}>
              <div style={{ textAlign: 'center' }}>
                <h2 className="type-headline-lg">Ready to join?</h2>
                <p className="type-body-md" style={{ color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                  You are the host. Others can join with the invite link.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '16px', width: '100%', maxWidth: '480px' }}>
                <button
                  id="join-now-btn"
                  onClick={handleJoin}
                  className="btn-action animate-join-pulse"
                  style={{ flex: 1, height: '56px', padding: 0, justifyContent: 'center' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>videocam</span>
                  Join Now
                </button>
                <button
                  id="audio-only-btn"
                  onClick={handleJoin}
                  className="btn-secondary"
                  style={{ padding: '0 32px', height: '56px' }}
                >
                  Audio Only
                </button>
              </div>
            </div>
          </div>

          {/* Permission toast */}
          {!toastDismissed && (
            <div style={{
              position: 'absolute', top: '40px',
              background: 'var(--primary)', color: '#fff',
              padding: '16px 24px',
              display: 'flex', alignItems: 'center', gap: '16px',
              zIndex: 10,
            }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--vibrant-lime)' }}>verified_user</span>
              <span className="type-label-sm" style={{ textTransform: 'uppercase' }}>Lakeside requests media permissions</span>
              <button
                onClick={() => setToastDismissed(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', marginLeft: '8px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
              </button>
            </div>
          )}

          {/* Settings Modal */}
          {showSettings && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <div style={{
                background: 'var(--surface-container-lowest)', padding: '32px', borderRadius: '16px',
                width: '400px', maxWidth: '90%', border: '1px solid var(--border-subtle)',
                display: 'flex', flexDirection: 'column', gap: '24px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 className="type-headline-md">Device Settings</h2>
                  <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="type-label-sm" style={{ color: 'var(--on-surface-variant)' }}>Microphone</label>
                  <select 
                    value={selectedAudio} 
                    onChange={e => setSelectedAudio(e.target.value)}
                    style={{ padding: '12px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--on-surface)' }}
                  >
                    {devices.filter(d => d.kind === 'audioinput').map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone (${d.deviceId.slice(0,5)})`}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label className="type-label-sm" style={{ color: 'var(--on-surface-variant)' }}>Camera</label>
                  <select 
                    value={selectedVideo} 
                    onChange={e => setSelectedVideo(e.target.value)}
                    style={{ padding: '12px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--on-surface)' }}
                  >
                    {devices.filter(d => d.kind === 'videoinput').map(d => (
                      <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera (${d.deviceId.slice(0,5)})`}</option>
                    ))}
                  </select>
                </div>

                <button onClick={() => setShowSettings(false)} className="btn-action" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
                  Done
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Footer meta */}
      <footer style={{
        height: '40px', padding: '0 40px',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)', fontSize: '10px', textTransform: 'uppercase' }}>
          SECURED END-TO-END ENCRYPTION
        </span>
        <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)', fontSize: '10px', textTransform: 'uppercase' }}>
          LAKESIDE V0.2.0
        </span>
      </footer>
    </div>
  );
};

export default RoomEntry;

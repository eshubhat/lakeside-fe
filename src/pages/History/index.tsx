import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { registerFiles } from '../../lib/fileRegistry';

import { AppLayout } from '../../components/AppLayout';

interface Recording {
  _id: string;
  key: string;
  name?: string;
  roomId?: string;
  durationSeconds?: number;
  expiresAt?: string;
  createdAt: string;
  downloadUrl: string;
}

interface Meeting {
  id: string;
  name: string;
  createdAt: string;
  durationSeconds: number;
  tracks: Recording[];
}

const History: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchRecordings = async () => {
      try {
        const { data } = await api.get<Recording[]>('/upload/recordings');
        setRecordings(data);
      } catch (error) {
        console.error('Failed to fetch recordings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRecordings();
  }, []);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown duration';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const groupedMeetings = React.useMemo(() => {
    const map = new Map<string, Meeting>();
    for (const rec of recordings) {
      const id = rec.roomId || rec._id;
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: rec.roomId ? `Meeting Room: ${rec.roomId}` : 'Instant Session',
          createdAt: rec.createdAt,
          durationSeconds: rec.durationSeconds || 0,
          tracks: []
        });
      }
      const meeting = map.get(id)!;
      meeting.tracks.push(rec);
      if (rec.durationSeconds && rec.durationSeconds > meeting.durationSeconds) {
        meeting.durationSeconds = rec.durationSeconds;
      }
      if (new Date(rec.createdAt) < new Date(meeting.createdAt)) {
        meeting.createdAt = rec.createdAt;
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [recordings]);

  return (
    <AppLayout>
        {/* Header */}
        <header style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between', 
          alignItems: isMobile ? 'flex-start' : 'flex-end', 
          marginBottom: isMobile ? '32px' : '64px',
          gap: isMobile ? '24px' : '0'
        }}>
          <div>
            <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'block', marginBottom: '8px' }}>
              Workspace / Media
            </span>
            <h2 className="type-display-lg" style={{ letterSpacing: '-0.02em', fontSize: isMobile ? '32px' : undefined }}>
              Recording History
            </h2>
          </div>
          <div style={{ position: 'relative', alignSelf: isMobile ? 'flex-end' : 'auto' }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
              onClick={() => setShowDropdown(!showDropdown)}
            >
              <div style={{ textAlign: 'right' }}>
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

        {/* Recordings Grid */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--on-surface-variant)' }}>Loading...</div>
        ) : groupedMeetings.length === 0 ? (
          <div style={{ padding: isMobile ? '40px 20px' : '80px 40px', textAlign: 'center', border: '1px dashed var(--outline-variant)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--outline-variant)', marginBottom: '16px' }}>folder_open</span>
            <h3 className="type-headline-md" style={{ color: 'var(--on-surface-variant)' }}>No meetings found</h3>
            <p className="type-body-md" style={{ color: 'var(--on-surface-variant)' }}>Your recorded sessions will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1000px' }}>
            {groupedMeetings.map(meeting => (
              <MeetingFolderCard key={meeting.id} meeting={meeting} formatDate={formatDate} formatDuration={formatDuration} isMobile={isMobile} />
            ))}
          </div>
        )}
      </AppLayout>
  );
};

const MeetingFolderCard: React.FC<{ meeting: Meeting; formatDate: (d: string) => string; formatDuration: (s?: number) => string; isMobile?: boolean }> = ({ meeting, formatDate, formatDuration, isMobile }) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [importError, setImportError] = useState('');

  const handleEditMeeting = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (importing) return;
    try {
      setImporting(true);
      setImportError('');
      
      const files: File[] = [];
      for (let i = 0; i < meeting.tracks.length; i++) {
        const rec = meeting.tracks[i];
        setImportProgress(`Downloading track ${i + 1} of ${meeting.tracks.length}...`);
        
        const res = await api.get(`/upload/download-proxy?key=${encodeURIComponent(rec.key)}`, { responseType: 'blob' });
        const blob = res.data;
        
        let safeName = rec.name || `track-${i+1}.webm`;
        safeName = safeName.replace(/[^a-zA-Z0-9.\-_ ]/g, '_');
        if (!safeName.endsWith('.webm') && !safeName.endsWith('.mp4')) safeName += '.webm';
        
        files.push(new File([blob], safeName, { type: 'video/webm' }));
      }
      
      setImportProgress('Preparing editor...');
      const projectId = `proj-${Date.now()}`;
      registerFiles(projectId, files);

      const newProject = {
        id: projectId,
        name: `Edited ${meeting.name}`,
        duration: formatDuration(meeting.durationSeconds),
        createdAt: 'Just now',
        size: `${(files.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(1)} MB`,
        videoUrl: URL.createObjectURL(files[0]),
      };

      try {
        const raw = localStorage.getItem('lk_editor_projects');
        const existing = raw ? JSON.parse(raw) : [];
        localStorage.setItem('lk_editor_projects', JSON.stringify([newProject, ...existing]));
      } catch { }
      sessionStorage.setItem(`lk_project_${projectId}`, JSON.stringify(newProject));

      navigate(`/editor/${projectId}`);
    } catch (err) {
      console.error('Failed to import meeting:', err);
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
      setImportProgress('');
    }
  };

  return (
    <div style={{ background: 'var(--surface-container-lowest)', border: '1px solid var(--border-subtle)', transition: 'box-shadow 0.2s', boxShadow: hovered ? '0 8px 24px -4px rgba(0,0,0,0.05)' : 'none' }}>
      {/* Folder Header */}
      <div 
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: isMobile ? '16px' : '24px', cursor: 'pointer', 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: isMobile ? 'flex-start' : 'center', 
          justifyContent: 'space-between',
          gap: isMobile ? '16px' : '0',
          borderBottom: expanded ? '1px solid var(--border-subtle)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px', height: '48px', background: 'var(--surface-container-high)',
            borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>folder_open</span>
          </div>
          <div>
            <h4 className="type-headline-md" style={{ fontSize: '18px', color: 'var(--primary)' }}>{meeting.name}</h4>
            <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
              <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)' }}>{formatDate(meeting.createdAt)}</span>
              <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)' }}>•</span>
              <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)' }}>{meeting.tracks.length} track{meeting.tracks.length !== 1 ? 's' : ''}</span>
              <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)' }}>•</span>
              <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)' }}>{formatDuration(meeting.durationSeconds)}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', alignSelf: isMobile ? 'flex-end' : 'auto' }}>
          {importError && <span className="type-label-sm" style={{ color: 'var(--error)' }}>{importError}</span>}
          {importProgress && <span className="type-label-sm" style={{ color: 'var(--vibrant-lime)', background: 'var(--primary)', padding: '4px 8px' }}>{importProgress}</span>}
          <button
            onClick={handleEditMeeting}
            disabled={importing}
            className="btn-action"
            style={{ padding: '8px 16px', fontSize: '12px', opacity: importing ? 0.7 : 1, height: '36px' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{importing ? 'hourglass_empty' : 'movie_edit'}</span>
            <span style={{ display: isMobile ? 'none' : 'inline' }}>Edit Meeting</span>
            {isMobile && <span>Edit</span>}
          </button>
          <span className="material-symbols-outlined" style={{ color: 'var(--outline)', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            expand_more
          </span>
        </div>
      </div>

      {/* Tracks Grid */}
      {expanded && (
        <div style={{ padding: '24px', background: 'var(--surface-gray)' }}>
          <h5 className="type-label-sm" style={{ marginBottom: '16px', color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>Individual Tracks</h5>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {meeting.tracks.map(rec => (
              <div key={rec._id} style={{ flex: '1 1 240px', maxWidth: isMobile ? '100%' : 'calc(50% - 8px)' }}>
                <RecordingCard recording={rec} formatDate={formatDate} formatDuration={formatDuration} isMobile={isMobile} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const RecordingCard: React.FC<{ recording: Recording; formatDate: (d: string) => string; formatDuration: (s?: number) => string; isMobile?: boolean }> = ({ recording, formatDate, formatDuration, isMobile }) => {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const handleDownload = (e: React.MouseEvent, _type: string) => {
    e.stopPropagation();
    // In the future, '_type' will dictate which transcoded URL to use.
    // For now, all options download the original uploaded WebM file.
    setMenuOpen(false);
    window.open(recording.downloadUrl, '_blank');
  };

  const handleEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (importing) return;
    try {
      setImporting(true);
      setImportError('');
      const res = await api.get(`/upload/download-proxy?key=${encodeURIComponent(recording.key)}`, { responseType: 'blob' });
      const blob = res.data;
      
      // Sanitise the filename so it doesn't contain characters that might break the FFmpeg virtual filesystem
      let safeName = recording.name || `recording-${recording.roomId || 'session'}.webm`;
      safeName = safeName.replace(/[^a-zA-Z0-9.\-_ ]/g, '_');
      if (!safeName.endsWith('.webm') && !safeName.endsWith('.mp4')) safeName += '.webm';

      const file = new File([blob], safeName, { type: 'video/webm' });

      const projectId = `proj-${Date.now()}`;
      registerFiles(projectId, [file]);

      const newProject = {
        id: projectId,
        name: recording.name || `Edited Recording ${formatDate(recording.createdAt)}`,
        duration: formatDuration(recording.durationSeconds),
        createdAt: 'Just now',
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        videoUrl: URL.createObjectURL(file),
      };

      try {
        const raw = localStorage.getItem('lk_editor_projects');
        const existing = raw ? JSON.parse(raw) : [];
        localStorage.setItem('lk_editor_projects', JSON.stringify([newProject, ...existing]));
      } catch { }
      sessionStorage.setItem(`lk_project_${projectId}`, JSON.stringify(newProject));

      navigate(`/editor/${projectId}`);
    } catch (err) {
      console.error('Failed to import video:', err);
      setImportError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        background: 'var(--surface-container-lowest)',
        border: hovered ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
        padding: '24px',
        position: 'relative',
        transition: pressed ? 'border-color 0.2s, box-shadow 0.3s' : 'transform 0.3s, border-color 0.2s, box-shadow 0.3s',
        transform: hovered && !pressed ? 'translateY(-4px)' : 'none',
        boxShadow: hovered && !pressed ? '0 12px 30px -4px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{
          width: '40px', height: '40px', background: 'var(--surface-container-high)',
          borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>videocam</span>
        </div>
        <div>
          <h4 className="type-button" style={{ color: 'var(--primary)', textTransform: 'none', letterSpacing: '0' }}>{recording.name || `Room: ${recording.roomId || 'Instant Session'}`}</h4>
          <p className="type-label-sm" style={{ color: 'var(--on-surface-variant)', fontSize: '11px' }}>
            {formatDate(recording.createdAt)}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', gap: isMobile ? '16px' : '0' }}>
        <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)' }}>
          {formatDuration(recording.durationSeconds)}
        </span>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end' }}>
          {importError && (
            <span className="type-label-sm" style={{ color: 'var(--error)', marginRight: '8px' }}>
              {importError}
            </span>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleEdit}
              disabled={importing}
              className="btn-action"
              style={{ padding: '8px 16px', fontSize: '12px', gap: '4px', height: '32px', cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.7 : 1 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                {importing ? 'hourglass_empty' : 'movie_edit'}
              </span>
              {importing ? 'Importing...' : 'Edit'}
            </button>

            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '12px', gap: '4px', height: '32px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
                {!isMobile && 'Download'}
              </button>

              {menuOpen && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                  background: 'var(--surface-container-lowest)', border: '1px solid var(--primary)',
                  boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', zIndex: 100, minWidth: '160px',
                  display: 'flex', flexDirection: 'column'
                }}>
                  <button onClick={(e) => handleDownload(e, 'original')} style={menuItemStyle}>
                    Original Quality
                  </button>
                  <button onClick={(e) => handleDownload(e, '1080p')} style={menuItemStyle}>
                    1080p High
                  </button>
                  <button onClick={(e) => handleDownload(e, '720p')} style={menuItemStyle}>
                    720p Standard
                  </button>
                  <button onClick={(e) => handleDownload(e, 'audio')} style={menuItemStyle}>
                    Audio Only (M4A)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const menuItemStyle: React.CSSProperties = {
  background: 'none', border: 'none', padding: '12px 16px', textAlign: 'left',
  fontFamily: 'var(--font-button)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
  color: 'var(--primary)', borderBottom: '1px solid var(--border-subtle)'
};

export default History;

import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { registerFiles, getFiles } from '../../lib/fileRegistry';

interface VideoProject {
  id: string;
  name: string;
  duration: string;
  createdAt: string;
  size: string;
  videoUrl?: string;
}

const NAV_ITEMS = [
  { icon: 'dashboard',   label: 'Dashboard',    href: '/' },
  { icon: 'videocam',    label: 'New Room',      href: '/room' },
  { icon: 'movie_edit',  label: 'Video Editor',  href: '/editor', active: true },
  { icon: 'history',     label: 'History',       href: '/history' },
];

const DEMO_PROJECTS: VideoProject[] = [
  { id: 'demo-1', name: 'Product Launch Reel', duration: '2:34', createdAt: '2 hours ago',  size: '148 MB' },
  { id: 'demo-2', name: 'Team Standup #12',    duration: '0:58', createdAt: 'Yesterday',    size: '62 MB'  },
  { id: 'demo-3', name: 'Design Review — Q2',  duration: '5:11', createdAt: '3 days ago',   size: '320 MB' },
];

function getStoredProjects(): VideoProject[] {
  try {
    const raw = localStorage.getItem('lk_editor_projects');
    return raw ? JSON.parse(raw) : DEMO_PROJECTS;
  } catch {
    return DEMO_PROJECTS;
  }
}

function storeProject(p: VideoProject) {
  try {
    const existing = getStoredProjects().filter(x => x.id !== p.id);
    localStorage.setItem('lk_editor_projects', JSON.stringify([p, ...existing]));
  } catch { /* storage quota */ }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function totalBytes(files: File[]): number {
  return files.reduce((sum, f) => sum + f.size, 0);
}

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', 'video/x-msvideo'];

const EditorImport: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reImportRef = useRef<HTMLInputElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const [dragOver, setDragOver]           = useState(false);
  const [queuedFiles, setQueuedFiles]     = useState<File[]>([]);
  const [projects, setProjects]           = useState<VideoProject[]>(getStoredProjects);
  const [projectName, setProjectName]     = useState('');
  const [error, setError]                 = useState('');
  // For re-opening a saved project whose files are no longer in registry
  const [pendingProject, setPendingProject] = useState<VideoProject | null>(null);

  const addFiles = useCallback((incoming: File[]) => {
    const valid: File[] = [];
    const invalid: string[] = [];

    for (const f of incoming) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        invalid.push(f.name);
      } else if (f.size > 2 * 1024 * 1024 * 1024) {
        invalid.push(`${f.name} (> 2 GB)`);
      } else {
        valid.push(f);
      }
    }

    if (invalid.length > 0) {
      setError(`Skipped unsupported/oversized: ${invalid.join(', ')}`);
    } else {
      setError('');
    }

    if (valid.length === 0) return;

    setQueuedFiles(prev => {
      const merged = [...prev, ...valid];
      // Auto-name from first file if name is empty
      if (!projectName && merged.length > 0) {
        setProjectName(merged[0].name.replace(/\.[^.]+$/, ''));
      }
      return merged;
    });
  }, [projectName]);

  const removeFile = useCallback((index: number) => {
    setQueuedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
    addFiles(files);
  }, [addFiles]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('video/'));
    addFiles(files);
    e.target.value = '';
  };

  const handleOpenEditor = () => {
    if (queuedFiles.length === 0) return;
    const id = `proj-${Date.now()}`;
    const name = projectName || queuedFiles[0].name.replace(/\.[^.]+$/, '');

    // Register File objects so VideoEditor can access them
    registerFiles(id, queuedFiles);

    const newProject: VideoProject = {
      id,
      name,
      duration: '—',
      createdAt: 'Just now',
      size: formatBytes(totalBytes(queuedFiles)),
      videoUrl: URL.createObjectURL(queuedFiles[0]),
    };
    storeProject(newProject);
    sessionStorage.setItem(`lk_project_${id}`, JSON.stringify(newProject));

    navigate(`/editor/${id}`);
  };

  const handleOpenProject = (project: VideoProject) => {
    // If the File objects are still in memory (same session), navigate directly
    const files = getFiles(project.id);
    if (files && files.length > 0) {
      navigate(`/editor/${project.id}`);
      return;
    }
    // Otherwise prompt the user to re-select the video file(s)
    setPendingProject(project);
    // Small delay so React can render before the native dialog opens
    requestAnimationFrame(() => reImportRef.current?.click());
  };

  // Called after user picks files for a saved project
  const handleReImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!pendingProject) return;
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('video/'));
    if (files.length === 0) { setPendingProject(null); return; }
    registerFiles(pendingProject.id, files);
    navigate(`/editor/${pendingProject.id}`);
    setPendingProject(null);
    e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--surface)' }}>

      {/* Hidden file input for re-importing files into an existing project */}
      <input
        ref={reImportRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo"
        multiple
        style={{ display: 'none' }}
        onChange={handleReImportChange}
      />

      {/* ── Re-import Dialog (shown when opening a saved project with no files in memory) */}
      {pendingProject && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setPendingProject(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--surface-container-lowest)',
              border: '1px solid var(--primary)',
              padding: '40px',
              maxWidth: '480px',
              width: '90vw',
              display: 'flex', flexDirection: 'column', gap: '20px',
            }}
          >
            {/* Header */}
            <div>
              <p style={{ fontFamily: 'var(--font-label)', fontSize: '10px', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '8px' }}>
                Re-open Project
              </p>
              <h3 className="type-headline-md" style={{ fontSize: '20px' }}>
                {pendingProject.name}
              </h3>
            </div>

            {/* Explanation */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              padding: '14px 16px',
              background: 'var(--surface-container)', border: '1px solid var(--border-subtle)',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--vibrant-lime)', flexShrink: 0, marginTop: '1px' }}>
                info
              </span>
              <p className="type-body-md" style={{ fontSize: '13px', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
                Video files aren't stored between sessions — please re-select the original file(s) to continue editing this project.
              </p>
            </div>

            {/* Project meta */}
            <div style={{ display: 'flex', gap: '24px' }}>
              {[
                { label: 'Duration', value: pendingProject.duration },
                { label: 'Size', value: pendingProject.size },
                { label: 'Created', value: pendingProject.createdAt },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '10px', marginBottom: '4px' }}>{label}</p>
                  <p className="type-button" style={{ color: 'var(--primary)', textTransform: 'none', letterSpacing: 0, fontSize: '13px' }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <label
                id="reimport-file-btn"
                style={{
                  flex: 1, background: 'var(--primary)', color: 'var(--on-primary)',
                  fontFamily: 'var(--font-button)', fontSize: '12px', fontWeight: 700,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  padding: '14px 20px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
                onClick={() => reImportRef.current?.click()}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>upload_file</span>
                Select Video File(s)
              </label>
              <button
                onClick={() => setPendingProject(null)}
                style={{
                  background: 'none', border: '1px solid var(--border-subtle)',
                  color: 'var(--on-surface-variant)', fontFamily: 'var(--font-button)',
                  fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em',
                  textTransform: 'uppercase', padding: '14px 20px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Left Sidebar ───────────────────────────────────────────────── */}
      <aside style={{
        width: '320px', minWidth: '320px', height: '100vh',
        position: 'fixed', left: 0, top: 0,
        background: 'var(--surface)', borderRight: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column', padding: '32px 24px', gap: '8px', zIndex: 50,
      }}>
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

        {/* New Meeting CTA */}
        <button
          id="sidebar-new-meeting-btn"
          onClick={() => navigate('/room')}
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
              onClick={(e) => { e.preventDefault(); navigate(item.href); }}
              className={`sidebar-nav-item${item.active ? ' active' : ''}`}
            >
              <span className="material-symbols-outlined" style={{ fontVariationSettings: item.active ? "'FILL' 1" : "'FILL' 0" }}>
                {item.icon}
              </span>
              {item.label}
            </a>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ marginTop: 'auto', paddingTop: '32px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <a href="#" className="sidebar-nav-item">
            <span className="material-symbols-outlined">help</span>Help
          </a>
          <button
            id="editor-import-logout-btn"
            onClick={logout}
            className="sidebar-nav-item"
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <span className="material-symbols-outlined">logout</span>Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main style={{ marginLeft: '320px', flex: 1, minHeight: '100vh', padding: '40px', background: 'var(--surface-gray)' }}>

        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '48px' }}>
          <div>
            <span className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'block', marginBottom: '8px' }}>
              Video Editor / Import
            </span>
            <h2 className="type-display-lg" style={{ letterSpacing: '-0.02em' }}>
              Import Video
            </h2>
          </div>
          <div style={{ position: 'relative' }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', maxWidth: '1200px' }}>

          {/* ── Left: Drop Zone + File Queue + Controls ─────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Drag-and-drop zone */}
            <div
              id="video-drop-zone"
              className={`drop-zone${dragOver ? ' drag-over' : ''}`}
              style={{ height: '240px', padding: '40px', background: 'var(--surface-container-lowest)' }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo"
                multiple
                onChange={handleFileInput}
                style={{ display: 'none' }}
              />

              <div style={{
                width: '72px', height: '72px',
                border: dragOver ? '2px solid var(--vibrant-lime)' : '1px solid var(--border-subtle)',
                background: dragOver ? 'rgba(166,228,46,0.08)' : 'var(--surface-container-high)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '20px', transition: 'all 0.2s',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '36px', color: dragOver ? 'var(--vibrant-lime)' : 'var(--on-surface-variant)' }}>
                  cloud_upload
                </span>
              </div>
              <h3 className="type-headline-md" style={{ marginBottom: '10px' }}>
                {queuedFiles.length > 0 ? 'Drop more files to add' : 'Drop your videos here'}
              </h3>
              <p className="type-body-md" style={{ color: 'var(--on-surface-variant)', marginBottom: '16px', maxWidth: '320px' }}>
                Drag & drop or click to browse. Multiple files supported — up to 2 GB each.
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {['MP4', 'MOV', 'WEBM', 'MKV', 'AVI'].map(fmt => (
                  <span key={fmt} style={{
                    fontFamily: 'var(--font-label)', fontSize: '11px', fontWeight: 500,
                    letterSpacing: '0.05em', padding: '4px 10px',
                    background: 'var(--surface-container)', border: '1px solid var(--border-subtle)',
                  }}>{fmt}</span>
                ))}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div style={{
                padding: '14px 16px', background: 'var(--error-container)',
                border: '1px solid var(--error)', display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--error)', fontSize: '20px' }}>error</span>
                <p className="type-body-md" style={{ color: 'var(--on-error-container)' }}>{error}</p>
              </div>
            )}

            {/* File queue */}
            {queuedFiles.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <p className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {queuedFiles.length} File{queuedFiles.length > 1 ? 's' : ''} · {formatBytes(totalBytes(queuedFiles))}
                  </p>
                  <button
                    onClick={() => setQueuedFiles([])}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)', fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                  >
                    Clear all
                  </button>
                </div>

                <div>
                  {queuedFiles.map((file, i) => (
                    <div key={`${file.name}-${i}`} className="file-queue-item">
                      <div style={{
                        width: '36px', height: '36px', background: 'var(--surface-container-high)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--vibrant-lime)' }}>videocam</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="type-button" style={{ color: 'var(--primary)', textTransform: 'none', letterSpacing: 0, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </p>
                        <p className="type-label-sm" style={{ color: 'var(--on-surface-variant)', fontSize: '11px' }}>
                          {formatBytes(file.size)} · {file.type.split('/')[1]?.toUpperCase()}
                        </p>
                      </div>
                      {/* Order badge */}
                      <span style={{
                        width: '22px', height: '22px', background: 'var(--primary)',
                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-label)', fontSize: '11px', fontWeight: 600, flexShrink: 0,
                      }}>
                        {i + 1}
                      </span>
                      <button
                        onClick={() => removeFile(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Project name + Open in Editor */}
            {queuedFiles.length > 0 && (
              <div style={{
                background: 'var(--surface-container-lowest)',
                border: '1px solid var(--border-subtle)',
                padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: '20px',
              }}>
                <div>
                  <label className="type-label-sm" style={{ display: 'block', color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                    Project Name
                  </label>
                  <div style={{ borderBottom: '1px solid var(--primary)', display: 'flex', alignItems: 'center' }}>
                    <input
                      id="project-name-input"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Enter project name…"
                      className="type-body-md"
                      style={{
                        background: 'none', border: 'none', outline: 'none',
                        fontFamily: 'var(--font-headline)', fontSize: '18px', fontWeight: 600,
                        width: '100%', padding: '8px 0', color: 'var(--on-surface)',
                      }}
                    />
                    <span className="material-symbols-outlined" style={{ color: 'var(--on-surface-variant)', fontSize: '20px' }}>edit</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    id="open-editor-btn"
                    onClick={handleOpenEditor}
                    className="btn-action"
                    style={{ padding: '14px 32px' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>movie_edit</span>
                    Open {queuedFiles.length > 1 ? `${queuedFiles.length} Clips` : 'in Editor'}
                  </button>
                  <label className="btn-secondary" style={{ padding: '14px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                    Add More
                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={handleFileInput}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Import from recording history */}
            <div
              style={{
                background: 'var(--primary)', color: '#fff',
                padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                border: '1px solid var(--primary)', position: 'relative', overflow: 'hidden', cursor: 'pointer',
              }}
              onClick={() => navigate('/history')}
            >
              <div style={{
                position: 'absolute', right: '-32px', top: '-32px',
                width: '160px', height: '160px',
                border: '32px solid rgba(166,228,46,0.08)', borderRadius: '50%', pointerEvents: 'none',
              }} />
              <div style={{ zIndex: 1 }}>
                <p className="type-label-sm" style={{ color: 'var(--vibrant-lime)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                  Or use a recording
                </p>
                <h4 className="type-headline-md" style={{ color: '#fff' }}>Import from Session History</h4>
              </div>
              <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'var(--vibrant-lime)', zIndex: 1 }}>history</span>
            </div>
          </div>

          {/* ── Right: Recent Projects ──────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Recent Projects
              </h3>
              <button
                onClick={() => setProjects(DEMO_PROJECTS)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--on-surface-variant)' }}>refresh</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onOpen={handleOpenProject}
                />
              ))}

              {projects.length === 0 && (
                <div style={{
                  padding: '40px', textAlign: 'center',
                  border: '1px dashed var(--border-subtle)',
                  background: 'var(--surface-container-lowest)',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--on-surface-variant)', display: 'block', marginBottom: '12px' }}>movie</span>
                  <p className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>No projects yet</p>
                </div>
              )}
            </div>

            {/* Capabilities card */}
            <div style={{
              marginTop: '8px', padding: '24px',
              background: 'var(--surface-container-lowest)',
              border: '1px solid var(--border-subtle)',
            }}>
              <h4 className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>
                Editor Capabilities
              </h4>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', listStyle: 'none' }}>
                {[
                  { icon: 'cut',              text: 'Trim & split clips on the timeline' },
                  { icon: 'merge',            text: 'Merge multiple video files' },
                  { icon: 'audio_file',       text: 'Waveform visualisation per clip' },
                  { icon: 'movie_creation',   text: 'FFmpeg-powered export (MP4 / WebM)' },
                  { icon: 'zoom_in',          text: 'Timeline zoom & scrubbing' },
                ].map(tip => (
                  <li key={tip.icon} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--vibrant-lime)', flexShrink: 0, marginTop: '2px' }}>
                      {tip.icon}
                    </span>
                    <p className="type-body-md" style={{ fontSize: '14px', color: 'var(--on-surface-variant)', lineHeight: 1.4 }}>{tip.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const ProjectCard: React.FC<{ project: VideoProject; onOpen: (p: VideoProject) => void }> = ({ project, onOpen }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="project-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(project)}
      style={{ border: hovered ? '1px solid var(--primary)' : '1px solid var(--border-subtle)' }}
    >
      {/* Thumbnail */}
      <div style={{
        height: '100px', background: 'var(--video-placeholder)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="waveform-bar"
              style={{ animationDelay: `${i * 0.05}s`, height: `${Math.random() * 24 + 4}px`, opacity: hovered ? 1 : 0.4 }}
            />
          ))}
        </div>
        <div style={{
          position: 'absolute', top: '8px', left: '8px',
          background: 'rgba(0,0,0,0.8)', padding: '2px 8px',
          fontFamily: 'var(--font-label)', fontSize: '11px', fontWeight: 500,
          letterSpacing: '0.05em', color: '#fff',
        }}>
          {project.duration}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="type-button" style={{ color: 'var(--primary)', marginBottom: '4px' }}>{project.name}</p>
          <p className="type-label-sm" style={{ color: 'var(--on-surface-variant)', fontSize: '11px' }}>
            {project.createdAt} · {project.size}
          </p>
        </div>
        <button
          id={`open-project-${project.id}`}
          onClick={(e) => { e.stopPropagation(); onOpen(project); }}
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: '12px' }}
        >
          Open
        </button>
      </div>
    </div>
  );
};

export default EditorImport;

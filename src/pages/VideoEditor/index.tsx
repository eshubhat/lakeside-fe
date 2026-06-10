/**
 * VideoEditor/index.tsx
 * Full functional video editor:
 *  - Multi-clip timeline with real in/out points
 *  - Drag handles to trim
 *  - Cut tool to split clips
 *  - Sequential multi-clip playback
 *  - Waveform visualization (Web Audio API)
 *  - File drop onto timeline to add clips
 *  - FFmpeg.wasm export (trim + concat)
 */

import React, {
  useState, useRef, useEffect, useCallback, useMemo,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFFmpeg } from '../../hooks/useFFmpeg';
import { getFiles, addFilesToProject } from '../../lib/fileRegistry';

const PX_PER_SEC = 80;      // pixels per second at zoom=1
const MIN_CLIP_DUR = 0.2;   // minimum clip duration in seconds
const CLIP_H = 44;          // timeline track height (px)

export interface EditClip {
  id: string;
  name: string;
  file: File;
  blobUrl: string;
  originalDuration: number;
  inPoint: number;   // trim start (seconds within original)
  outPoint: number;  // trim end (seconds within original)
}

type ActiveTool = 'select' | 'cut' | 'text' | 'transition' | 'audio' | 'color';
type ExportState = 'idle' | 'loading-ffmpeg' | 'exporting' | 'done' | 'error';

interface TrimDrag {
  clipId: string;
  side: 'left' | 'right';
  startX: number;
  startPoint: number; // initial inPoint or outPoint
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

async function getVideoDuration(blobUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve(isFinite(v.duration) ? v.duration : 60);
    v.onerror = () => resolve(60);
    v.src = blobUrl;
  });
}

async function generateWaveform(file: File, samples = 80): Promise<Float32Array> {
  try {
    const ctx = new AudioContext();
    const buf = await file.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf);
    const data = audio.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(data.length / samples));
    const peaks = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        max = Math.max(max, Math.abs(data[i * blockSize + j] ?? 0));
      }
      peaks[i] = max;
    }
    await ctx.close();
    return peaks;
  } catch {
    // Fallback: synthetic waveform
    const peaks = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      peaks[i] = 0.3 + 0.5 * Math.abs(Math.sin(i * 0.4));
    }
    return peaks;
  }
}

// Compute clip's pixel offset on the timeline (all clips before it, summed)
function clipStartPx(clips: EditClip[], index: number, zoom: number): number {
  return clips
    .slice(0, index)
    .reduce((acc, c) => acc + (c.outPoint - c.inPoint) * PX_PER_SEC * zoom, 0);
}

// Compute total timeline duration in seconds
function totalDuration(clips: EditClip[]): number {
  return clips.reduce((acc, c) => acc + (c.outPoint - c.inPoint), 0);
}

// Given a global time, return { clipIndex, localTime (within clip) }
function resolveGlobalTime(
  clips: EditClip[],
  globalTime: number,
): { clipIndex: number; localTime: number } {
  let elapsed = 0;
  for (let i = 0; i < clips.length; i++) {
    const dur = clips[i].outPoint - clips[i].inPoint;
    if (globalTime <= elapsed + dur || i === clips.length - 1) {
      return {
        clipIndex: i,
        localTime: clips[i].inPoint + (globalTime - elapsed),
      };
    }
    elapsed += dur;
  }
  return { clipIndex: 0, localTime: clips[0]?.inPoint ?? 0 };
}

const VideoEditor: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const ffmpeg = useFFmpeg();

  const [projectName, setProjectName] = useState('Untitled Project');
  const [editingName, setEditingName] = useState(false);

  const [clips, setClips] = useState<EditClip[]>([]);
  const [waveforms, setWaveforms] = useState<Map<string, Float32Array>>(new Map());
  const [loadingClips, setLoadingClips] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activeClipIndex, setActiveClipIndex] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [trimDrag, setTrimDrag] = useState<TrimDrag | null>(null);
  const [timelineDropHover, setTimelineDropHover] = useState(false);
  const [showProperties, setShowProperties] = useState(true);

  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState<'mp4' | 'webm'>('mp4');
  const [exportQuality, setExportQuality] = useState<'high' | 'medium' | 'low'>('medium');
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState('');
  const [exportUrl, setExportUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineTracksRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const currentClipIdRef = useRef<string | null>(null); // tracks which clip is in <video>

  // CLIP LOADING

  const fileToClip = useCallback(async (file: File): Promise<EditClip> => {
    const blobUrl = URL.createObjectURL(file);
    const originalDuration = await getVideoDuration(blobUrl);
    return {
      id: uid(),
      name: file.name.replace(/\.[^.]+$/, ''),
      file,
      blobUrl,
      originalDuration,
      inPoint: 0,
      outPoint: originalDuration,
    };
  }, []);

  const addClips = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setLoadingClips(true);
    const newClips = await Promise.all(files.map(fileToClip));
    setClips(prev => [...prev, ...newClips]);
    if (projectId) addFilesToProject(projectId, files);
    setLoadingClips(false);
  }, [fileToClip, projectId]);

  // Load initial clips from fileRegistry on mount
  useEffect(() => {
    if (!projectId) return;
    const raw = sessionStorage.getItem(`lk_project_${projectId}`);
    if (raw) {
      try {
        const p = JSON.parse(raw) as { name?: string };
        if (p.name) setProjectName(p.name);
      } catch { /* */ }
    }

    const files = getFiles(projectId);
    if (files && files.length > 0) {
      addClips(files);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Generate waveforms whenever clips change
  useEffect(() => {
    for (const clip of clips) {
      if (!waveforms.has(clip.id)) {
        generateWaveform(clip.file).then(peaks => {
          setWaveforms(prev => new Map(prev).set(clip.id, peaks));
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips]);

  // PLAYBACK ENGINE

  const globalOffset = useCallback((clipIndex: number): number => {
    return clips.slice(0, clipIndex).reduce((acc, c) => acc + (c.outPoint - c.inPoint), 0);
  }, [clips]);

  const switchToClip = useCallback((index: number, seekLocalTime?: number) => {
    const clip = clips[index];
    const vid = videoRef.current;
    if (!clip || !vid) return;

    setActiveClipIndex(index);

    const localTime = seekLocalTime ?? clip.inPoint;

    if (currentClipIdRef.current !== clip.id) {
      currentClipIdRef.current = clip.id;
      vid.src = clip.blobUrl;
      vid.load();
      vid.oncanplay = () => {
        vid.currentTime = localTime;
        vid.oncanplay = null;
      };
    } else {
      vid.currentTime = localTime;
    }
  }, [clips]);

  const handleVideoTimeUpdate = useCallback(() => {
    const vid = videoRef.current;
    const clip = clips[activeClipIndex];
    if (!vid || !clip) return;

    // Update global time display
    const gt = globalOffset(activeClipIndex) + (vid.currentTime - clip.inPoint);
    setCurrentTime(Math.max(0, gt));

    // Advance to next clip when we reach outPoint
    if (vid.currentTime >= clip.outPoint - 0.1) {
      const next = activeClipIndex + 1;
      if (next < clips.length) {
        vid.pause();
        switchToClip(next, clips[next].inPoint);
        if (playing) {
          vid.oncanplay = () => {
            vid.play().catch(() => {});
            vid.oncanplay = null;
          };
        }
      } else {
        vid.pause();
        setPlaying(false);
        setCurrentTime(totalDuration(clips));
      }
    }
  }, [clips, activeClipIndex, globalOffset, playing, switchToClip]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.addEventListener('timeupdate', handleVideoTimeUpdate);
    return () => vid.removeEventListener('timeupdate', handleVideoTimeUpdate);
  }, [handleVideoTimeUpdate]);

  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (clips.length === 0) return;

    if (playing) {
      vid.pause();
      setPlaying(false);
    } else {
      if (clips[activeClipIndex]) {
        if (currentClipIdRef.current !== clips[activeClipIndex].id) {
          switchToClip(activeClipIndex);
          vid.oncanplay = () => {
            vid.play().catch(() => {});
            vid.oncanplay = null;
          };
        } else {
          vid.play().catch(() => {});
        }
      }
      setPlaying(true);
    }
  }, [playing, clips, activeClipIndex, switchToClip]);

  const seekTo = useCallback((globalTime: number) => {
    const clamped = Math.max(0, Math.min(totalDuration(clips), globalTime));
    const { clipIndex, localTime } = resolveGlobalTime(clips, clamped);
    setCurrentTime(clamped);
    switchToClip(clipIndex, localTime);
  }, [clips, switchToClip]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'KeyV') setActiveTool('select');
      if (e.code === 'KeyC') setActiveTool('cut');
      if (e.code === 'KeyT') setActiveTool('text');
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipId) {
          setClips(prev => prev.filter(c => c.id !== selectedClipId));
          setSelectedClipId(null);
        }
      }
      if (e.code === 'Escape') { setSelectedClipId(null); setShowExport(false); }
      if (e.code === 'ArrowLeft') seekTo(currentTime - 1 / 30);
      if (e.code === 'ArrowRight') seekTo(currentTime + 1 / 30);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, selectedClipId, seekTo, currentTime]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.volume = volume;
    vid.muted = muted;
  }, [volume, muted]);

  // TRIM DRAG

  const handleTrimMouseDown = useCallback((
    e: React.MouseEvent,
    clipId: string,
    side: 'left' | 'right',
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    setTrimDrag({
      clipId,
      side,
      startX: e.clientX,
      startPoint: side === 'left' ? clip.inPoint : clip.outPoint,
    });
  }, [clips]);

  useEffect(() => {
    if (!trimDrag) return;

    const onMouseMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - trimDrag.startX;
      const deltaSec = deltaPx / (PX_PER_SEC * zoom);

      setClips(prev => prev.map(clip => {
        if (clip.id !== trimDrag.clipId) return clip;
        if (trimDrag.side === 'left') {
          const newIn = Math.max(0, Math.min(
            clip.outPoint - MIN_CLIP_DUR,
            trimDrag.startPoint + deltaSec,
          ));
          return { ...clip, inPoint: newIn };
        } else {
          const newOut = Math.min(clip.originalDuration, Math.max(
            clip.inPoint + MIN_CLIP_DUR,
            trimDrag.startPoint + deltaSec,
          ));
          return { ...clip, outPoint: newOut };
        }
      }));
    };

    const onMouseUp = () => {
      setTrimDrag(null);
      // Sync video to updated clip position
      const updatedClip = clips.find(c => c.id === trimDrag.clipId);
      if (updatedClip && videoRef.current && currentClipIdRef.current === updatedClip.id) {
        videoRef.current.currentTime = updatedClip.inPoint;
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [trimDrag, zoom, clips]);

  // TIMELINE INTERACTION

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Don't seek if we're dragging a handle
    if (trimDrag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollLeft = e.currentTarget.scrollLeft;
    const px = e.clientX - rect.left + scrollLeft;
    const sec = px / (PX_PER_SEC * zoom);
    seekTo(sec);
  }, [trimDrag, zoom, seekTo]);

  const handleClipClick = useCallback((e: React.MouseEvent, clip: EditClip, clipIndex: number) => {
    e.stopPropagation();
    if (activeTool === 'cut') {
      // Split the clip at the current playhead position
      const clipStart = globalOffset(clipIndex);
      const localTime = currentTime - clipStart + clip.inPoint;
      if (localTime <= clip.inPoint + MIN_CLIP_DUR || localTime >= clip.outPoint - MIN_CLIP_DUR) return;

      const first: EditClip = { ...clip, id: uid(), outPoint: localTime };
      const second: EditClip = { ...clip, id: uid(), inPoint: localTime };

      setClips(prev => [
        ...prev.slice(0, clipIndex),
        first,
        second,
        ...prev.slice(clipIndex + 1),
      ]);
      setSelectedClipId(first.id);
    } else {
      setSelectedClipId(prev => prev === clip.id ? null : clip.id);
    }
  }, [activeTool, globalOffset, currentTime]);

  // FILE DROP ON TIMELINE

  const handleTimelineDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setTimelineDropHover(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('video/'));
    if (files.length > 0) await addClips(files);
  }, [addClips]);

  // EXPORT

  const handleExport = useCallback(async () => {
    if (clips.length === 0) return;
    setExportState('loading-ffmpeg');
    setExportProgress(0);
    setExportStage('Loading FFmpeg engine…');
    setExportUrl(null);

    const url = await ffmpeg.exportVideo({
      clips: clips.map(c => ({ file: c.file, inPoint: c.inPoint, outPoint: c.outPoint })),
      format: exportFormat,
      quality: exportQuality,
      onProgress: (pct, stg) => {
        setExportProgress(pct);
        setExportStage(stg);
      },
    });

    if (url) {
      setExportUrl(url);
      setExportState('done');
    } else {
      setExportState('error');
    }
  }, [clips, exportFormat, exportQuality, ffmpeg]);

  // DERIVED VALUES

  const totalDur = useMemo(() => totalDuration(clips), [clips]);
  const playheadPx = currentTime * PX_PER_SEC * zoom;
  const selectedClip = useMemo(() => clips.find(c => c.id === selectedClipId) ?? null, [clips, selectedClipId]);
  const selectedClipIdx = useMemo(() => clips.findIndex(c => c.id === selectedClipId), [clips, selectedClipId]);

  // Ruler ticks every 5 seconds
  const rulerTicks = useMemo(() => {
    const every = Math.max(1, Math.round(5 / zoom));
    const count = Math.ceil(totalDur / every) + 2;
    return Array.from({ length: count }, (_, i) => i * every);
  }, [totalDur, zoom]);

  const timelineW = Math.max(2000, (totalDur + 30) * PX_PER_SEC * zoom);

  // RENDER

  return (
    <div className="editor-layout" id="video-editor-root">

      {/* ━━━ TOP BAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <header className="editor-topbar">
        {/* Logo / Back */}
        <button
          id="editor-back-btn"
          onClick={() => navigate('/editor')}
          title="Back to Import"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '4px 8px', color: 'var(--editor-text-dim)',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--editor-text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--editor-text-dim)')}
        >
          <div style={{
            width: '28px', height: '28px', background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--vibrant-lime)', fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>
              signal_cellular_alt
            </span>
          </div>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_back</span>
        </button>

        <div style={{ width: '1px', height: '24px', background: 'var(--editor-border)', flexShrink: 0 }} />

        {/* Project name */}
        {editingName ? (
          <input
            ref={nameInputRef}
            id="editor-project-name-input"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            onBlur={() => setEditingName(false)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false); }}
            autoFocus
            style={{
              background: 'var(--editor-surface-mid)', border: '1px solid var(--vibrant-lime)',
              color: 'var(--editor-text)', fontFamily: 'var(--font-headline)',
              fontSize: '14px', fontWeight: 600, padding: '4px 10px',
              outline: 'none', width: '220px',
            }}
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--editor-text)', fontFamily: 'var(--font-headline)',
              fontSize: '14px', fontWeight: 600, padding: '4px 8px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--editor-surface-high)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            {projectName}
            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: 'var(--editor-text-dim)' }}>edit</span>
          </button>
        )}

        {/* Timecode */}
        <div style={{
          fontFamily: 'var(--font-label)', fontSize: '13px', fontWeight: 500,
          letterSpacing: '0.05em', color: 'var(--editor-playhead)',
          padding: '4px 10px', background: 'var(--editor-surface-mid)',
          border: '1px solid var(--editor-border)', flexShrink: 0,
        }}>
          {fmtTime(currentTime)}
          <span style={{ color: 'var(--editor-text-dim)', marginLeft: '6px' }}>/ {fmtTime(totalDur)}</span>
        </div>

        {/* Clip count badge */}
        <div style={{
          fontFamily: 'var(--font-label)', fontSize: '11px', fontWeight: 500,
          letterSpacing: '0.05em', color: 'var(--editor-text-dim)',
          padding: '2px 10px', border: '1px solid var(--editor-border)',
          flexShrink: 0,
        }}>
          {clips.length} CLIP{clips.length !== 1 ? 'S' : ''}
        </div>

        <div style={{ flex: 1 }} />

        {/* Undo / Redo (visual only) */}
        {[{ icon: 'undo' }, { icon: 'redo' }].map(({ icon }) => (
          <button key={icon} title={icon} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--editor-text-dim)', width: '32px', height: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--editor-surface-high)'; e.currentTarget.style.color = 'var(--editor-text)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--editor-text-dim)'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{icon}</span>
          </button>
        ))}

        <div style={{ width: '1px', height: '24px', background: 'var(--editor-border)' }} />

        {/* Add more clips button */}
        <label
          title="Add video files"
          style={{
            background: 'none', border: '1px solid var(--editor-border)',
            color: 'var(--editor-text)', fontFamily: 'var(--font-button)',
            fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', padding: '6px 14px',
            display: 'flex', alignItems: 'center', gap: '5px',
            cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--editor-text)'; e.currentTarget.style.background = 'var(--editor-surface-high)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--editor-border)'; e.currentTarget.style.background = 'none'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
          Add Clips
          <input
            type="file"
            accept="video/*"
            multiple
            style={{ display: 'none' }}
            onChange={e => {
              const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('video/'));
              if (files.length > 0) addClips(files);
              e.target.value = '';
            }}
          />
        </label>

        {/* Export */}
        <button
          id="editor-export-btn"
          onClick={() => { setShowExport(true); setExportState('idle'); setExportUrl(null); }}
          disabled={clips.length === 0}
          style={{
            background: clips.length === 0 ? 'var(--editor-surface-mid)' : 'var(--vibrant-lime)',
            color: clips.length === 0 ? 'var(--editor-text-dim)' : '#000',
            border: 'none', fontFamily: 'var(--font-button)', fontSize: '12px',
            fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            padding: '6px 20px', display: 'flex', alignItems: 'center', gap: '6px',
            cursor: clips.length === 0 ? 'not-allowed' : 'pointer',
            transition: 'opacity 0.15s',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
          Export
        </button>
      </header>

      {/* ━━━ WORKSPACE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="editor-workspace" style={{ flex: 1, minHeight: 0 }}>

        {/* ── Left Toolstrip ──────────────────────────────────────────────── */}
        <div className="editor-toolstrip">
          {([ 
            { id: 'select' as const, icon: 'arrow_selector_tool', label: 'Select  V' },
            { id: 'cut'    as const, icon: 'cut',                  label: 'Cut  C'  },
            { id: 'text'   as const, icon: 'title',                label: 'Text  T' },
          ]).map((tool, i) => (
            <React.Fragment key={tool.id}>
              {i === 2 && <div style={{ width: '32px', height: '1px', background: 'var(--editor-border)', margin: '4px 0' }} />}
              <button
                id={`tool-${tool.id}`}
                className={`editor-tool-btn${activeTool === tool.id ? ' active' : ''}`}
                onClick={() => setActiveTool(tool.id)}
                title={tool.label}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{tool.icon}</span>
                <span className="editor-tooltip">{tool.label}</span>
              </button>
            </React.Fragment>
          ))}

          <div style={{ margin: '4px 0', width: '32px', height: '1px', background: 'var(--editor-border)' }} />

          {/* Delete selected clip */}
          <button
            id="delete-clip-btn"
            className="editor-tool-btn"
            onClick={() => {
              if (selectedClipId) {
                setClips(prev => prev.filter(c => c.id !== selectedClipId));
                setSelectedClipId(null);
              }
            }}
            title="Delete selected (Del)"
            style={{ color: selectedClipId ? '#ff5555' : 'var(--editor-text-dim)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete</span>
            <span className="editor-tooltip">Delete Clip</span>
          </button>
        </div>

        {/* ── Center: Preview Canvas ───────────────────────────────────────── */}
        <div className="editor-canvas-area editor-canvas-bg">
          <span style={{
            position: 'absolute', top: '14px',
            fontFamily: 'var(--font-label)', fontSize: '10px',
            letterSpacing: '0.1em', color: 'var(--editor-text-dim)',
            textTransform: 'uppercase', pointerEvents: 'none',
          }}>
            Preview — {clips[activeClipIndex]?.name ?? 'No clip'}
          </span>

          <div className="editor-preview-wrapper" style={{ maxWidth: '820px' }}>
            {clips.length === 0 ? (
              /* Empty state */
              <div style={{
                width: '100%', height: '100%', background: '#000',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '16px',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--editor-text-dim)' }}>movie</span>
                {loadingClips ? (
                  <p style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: 'var(--editor-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Loading clips…
                  </p>
                ) : (
                  <>
                    <p style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: 'var(--editor-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      No video loaded
                    </p>
                    <label style={{
                      background: 'var(--vibrant-lime)', color: '#000', border: 'none',
                      fontFamily: 'var(--font-button)', fontSize: '12px', fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      padding: '10px 24px', cursor: 'pointer', display: 'inline-block',
                    }}>
                      Import Video
                      <input
                        type="file" accept="video/*" multiple style={{ display: 'none' }}
                        onChange={e => addClips(Array.from(e.target.files ?? []).filter(f => f.type.startsWith('video/')))}
                      />
                    </label>
                  </>
                )}
              </div>
            ) : (
              <video
                ref={videoRef}
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000', display: 'block' }}
                playsInline
                onEnded={() => {
                  // The timeupdate handler will advance; this is a safety net
                  const next = activeClipIndex + 1;
                  if (next < clips.length) switchToClip(next, clips[next].inPoint);
                  else setPlaying(false);
                }}
              />
            )}
          </div>

          {/* Playback controls */}
          <div style={{
            position: 'absolute', bottom: '12px',
            left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'rgba(13,13,13,0.92)', backdropFilter: 'blur(12px)',
            border: '1px solid var(--editor-border)', padding: '6px 14px',
            width: 'calc(100% - 32px)', maxWidth: '840px',
          }}>
            {/* Prev clip */}
            <button
              onClick={() => { if (activeClipIndex > 0) switchToClip(activeClipIndex - 1); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--editor-text-dim)', display: 'flex', alignItems: 'center', padding: '4px' }}
              title="Previous clip"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>skip_previous</span>
            </button>

            {/* Rewind 5s */}
            <button
              onClick={() => seekTo(currentTime - 5)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--editor-text-dim)', display: 'flex', alignItems: 'center', padding: '4px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>replay_5</span>
            </button>

            {/* Play / Pause */}
            <button
              id="preview-play-pause-btn"
              onClick={togglePlay}
              style={{
                width: '38px', height: '38px', flexShrink: 0,
                background: playing ? 'var(--vibrant-lime)' : 'var(--editor-surface-high)',
                border: '1px solid var(--editor-border-light)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: playing ? '#000' : 'var(--editor-text)', transition: 'all 0.15s',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '22px', fontVariationSettings: "'FILL' 1" }}>
                {playing ? 'pause' : 'play_arrow'}
              </span>
            </button>

            {/* Forward 5s */}
            <button
              onClick={() => seekTo(currentTime + 5)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--editor-text-dim)', display: 'flex', alignItems: 'center', padding: '4px' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>forward_5</span>
            </button>

            {/* Next clip */}
            <button
              onClick={() => { if (activeClipIndex < clips.length - 1) switchToClip(activeClipIndex + 1); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--editor-text-dim)', display: 'flex', alignItems: 'center', padding: '4px' }}
              title="Next clip"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>skip_next</span>
            </button>

            {/* Progress scrubber */}
            <input
              id="preview-scrubber"
              type="range"
              min={0}
              max={totalDur || 1}
              step={0.01}
              value={currentTime}
              onChange={e => seekTo(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: 'var(--editor-playhead)', height: '4px', cursor: 'pointer' }}
            />

            {/* Volume */}
            <button
              onClick={() => setMuted(m => !m)}
              style={{ background: 'none', border: 'none', color: muted ? '#ff5555' : 'var(--editor-text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                {muted ? 'volume_off' : volume > 0.5 ? 'volume_up' : 'volume_down'}
              </span>
            </button>
            <input
              type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume}
              onChange={e => { setVolume(parseFloat(e.target.value)); if (parseFloat(e.target.value) > 0) setMuted(false); }}
              style={{ width: '60px', accentColor: 'var(--editor-playhead)', height: '3px', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* ── Right Properties Panel ───────────────────────────────────────── */}
        {showProperties && (
          <div className="editor-panel editor-panel-right" style={{ width: '240px', overflowY: 'auto' }}>
            <div style={{
              height: '40px', background: 'var(--editor-bg)',
              borderBottom: '1px solid var(--editor-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 14px', flexShrink: 0,
            }}>
              <span className="prop-label">{selectedClip ? 'CLIP INFO' : 'PROJECT'}</span>
              <button
                onClick={() => setShowProperties(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--editor-text-dim)', display: 'flex' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
              </button>
            </div>

            <div style={{ padding: '14px' }}>
              {selectedClip ? (
                <>
                  {/* Clip name */}
                  <input
                    value={selectedClip.name}
                    onChange={e => {
                      const name = e.target.value;
                      setClips(prev => prev.map(c => c.id === selectedClip.id ? { ...c, name } : c));
                    }}
                    style={{
                      width: '100%', background: 'var(--editor-surface-mid)',
                      border: '1px solid var(--editor-border-light)',
                      color: 'var(--editor-text)', fontFamily: 'var(--font-headline)',
                      fontSize: '13px', fontWeight: 600, padding: '6px 8px',
                      outline: 'none', marginBottom: '16px',
                    }}
                    onFocus={e => (e.target.style.borderColor = 'var(--vibrant-lime)')}
                    onBlur={e => (e.target.style.borderColor = 'var(--editor-border-light)')}
                  />

                  <div className="prop-row">
                    <span className="prop-label">Source</span>
                    <span className="prop-value" style={{ fontSize: '10px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedClip.file.name}
                    </span>
                  </div>
                  <div className="prop-row">
                    <span className="prop-label">Duration</span>
                    <span className="prop-value">{fmtTime(selectedClip.outPoint - selectedClip.inPoint)}</span>
                  </div>
                  <div className="prop-row">
                    <span className="prop-label">In Point</span>
                    <span className="prop-value" style={{ color: 'var(--vibrant-lime)' }}>{fmtTime(selectedClip.inPoint)}</span>
                  </div>
                  <div className="prop-row">
                    <span className="prop-label">Out Point</span>
                    <span className="prop-value" style={{ color: 'var(--vibrant-lime)' }}>{fmtTime(selectedClip.outPoint)}</span>
                  </div>
                  <div className="prop-row">
                    <span className="prop-label">Source Dur</span>
                    <span className="prop-value">{fmtTime(selectedClip.originalDuration)}</span>
                  </div>
                  <div className="prop-row" style={{ borderBottom: 'none' }}>
                    <span className="prop-label">Size</span>
                    <span className="prop-value">{(selectedClip.file.size / 1_048_576).toFixed(1)} MB</span>
                  </div>

                  {/* Quick trim inputs */}
                  <div style={{ marginTop: '20px' }}>
                    <p className="prop-label" style={{ marginBottom: '10px' }}>TRIM IN POINT</p>
                    <input
                      type="range"
                      min={0} max={selectedClip.originalDuration} step={0.1}
                      value={selectedClip.inPoint}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        setClips(prev => prev.map(c => c.id === selectedClip.id
                          ? { ...c, inPoint: Math.min(v, c.outPoint - MIN_CLIP_DUR) }
                          : c));
                      }}
                      style={{ width: '100%', accentColor: 'var(--editor-playhead)', marginBottom: '12px' }}
                    />
                    <p className="prop-label" style={{ marginBottom: '10px' }}>TRIM OUT POINT</p>
                    <input
                      type="range"
                      min={0} max={selectedClip.originalDuration} step={0.1}
                      value={selectedClip.outPoint}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        setClips(prev => prev.map(c => c.id === selectedClip.id
                          ? { ...c, outPoint: Math.max(v, c.inPoint + MIN_CLIP_DUR) }
                          : c));
                      }}
                      style={{ width: '100%', accentColor: 'var(--editor-playhead)' }}
                    />
                  </div>

                  {/* Split button */}
                  <button
                    onClick={() => {
                      if (selectedClipIdx < 0) return;
                      handleClipClick({ stopPropagation: () => {} } as React.MouseEvent, selectedClip, selectedClipIdx);
                    }}
                    disabled={activeTool !== 'cut'}
                    style={{
                      marginTop: '20px', width: '100%', padding: '8px',
                      background: activeTool === 'cut' ? 'rgba(166,228,46,0.1)' : 'none',
                      border: `1px solid ${activeTool === 'cut' ? 'var(--vibrant-lime)' : 'var(--editor-border)'}`,
                      color: activeTool === 'cut' ? 'var(--vibrant-lime)' : 'var(--editor-text-dim)',
                      fontFamily: 'var(--font-button)', fontSize: '11px', fontWeight: 600,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      cursor: activeTool === 'cut' ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>cut</span>
                    Split at Playhead
                  </button>

                  <button
                    onClick={() => { setClips(prev => prev.filter(c => c.id !== selectedClipId)); setSelectedClipId(null); }}
                    style={{
                      marginTop: '8px', width: '100%', padding: '8px',
                      background: 'none', border: '1px solid #ff5555',
                      color: '#ff5555', fontFamily: 'var(--font-button)', fontSize: '11px',
                      fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase',
                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', gap: '6px', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,85,85,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>delete</span>
                    Delete Clip
                  </button>
                </>
              ) : (
                <>
                  {/* Project info */}
                  <div className="prop-row"><span className="prop-label">Clips</span><span className="prop-value">{clips.length}</span></div>
                  <div className="prop-row"><span className="prop-label">Total Duration</span><span className="prop-value">{fmtTime(totalDur)}</span></div>
                  <div className="prop-row" style={{ borderBottom: 'none' }}>
                    <span className="prop-label">Tool</span>
                    <span className="prop-value" style={{ textTransform: 'capitalize' }}>{activeTool}</span>
                  </div>

                  {/* Keyboard shortcuts */}
                  <div style={{ marginTop: '20px', padding: '12px', background: 'var(--editor-surface-mid)', border: '1px solid var(--editor-border)' }}>
                    <p className="prop-label" style={{ marginBottom: '10px' }}>SHORTCUTS</p>
                    {[
                      ['Space', 'Play / Pause'],
                      ['V', 'Select'],
                      ['C', 'Cut'],
                      ['← →', 'Frame step'],
                      ['Del', 'Delete clip'],
                      ['Esc', 'Deselect'],
                    ].map(([key, action]) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontFamily: 'var(--font-label)', fontSize: '10px', color: 'var(--vibrant-lime)', background: 'var(--editor-surface-high)', padding: '2px 6px', border: '1px solid var(--editor-border)' }}>{key}</span>
                        <span style={{ fontFamily: 'var(--font-label)', fontSize: '10px', color: 'var(--editor-text-dim)' }}>{action}</span>
                      </div>
                    ))}
                  </div>

                  {/* FFmpeg status */}
                  <div style={{ marginTop: '16px', padding: '10px', border: '1px solid var(--editor-border)', background: 'var(--editor-surface-mid)' }}>
                    <p className="prop-label" style={{ marginBottom: '6px' }}>FFMPEG ENGINE</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '8px', height: '8px', borderRadius: '50%',
                        background: ffmpeg.loaded ? 'var(--vibrant-lime)' : ffmpeg.loading ? '#f59e0b' : 'var(--editor-text-dim)',
                      }} />
                      <span style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: 'var(--editor-text-dim)' }}>
                        {ffmpeg.loaded ? 'Ready' : ffmpeg.loading ? `Loading… ${ffmpeg.progress}%` : 'Not loaded'}
                      </span>
                    </div>
                    {!ffmpeg.loaded && !ffmpeg.loading && (
                      <button
                        onClick={() => ffmpeg.load()}
                        style={{
                          marginTop: '8px', padding: '5px 12px',
                          background: 'none', border: '1px solid var(--editor-border)',
                          color: 'var(--editor-text-dim)', fontFamily: 'var(--font-label)',
                          fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em',
                          cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--vibrant-lime)'; e.currentTarget.style.color = 'var(--vibrant-lime)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--editor-border)'; e.currentTarget.style.color = 'var(--editor-text-dim)'; }}
                      >
                        Pre-load Engine
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ━━━ TIMELINE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div
        className="editor-timeline"
        onDragOver={e => { e.preventDefault(); setTimelineDropHover(true); }}
        onDragLeave={() => setTimelineDropHover(false)}
        onDrop={handleTimelineDrop}
        style={{ outline: timelineDropHover ? '2px dashed var(--vibrant-lime)' : 'none', outlineOffset: '-2px' }}
      >
        {/* Timeline header */}
        <div className="timeline-header">
          {/* Tool indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '14px', color: activeTool === 'cut' ? 'var(--vibrant-lime)' : 'var(--editor-text-dim)' }}>
              {activeTool === 'cut' ? 'cut' : 'arrow_selector_tool'}
            </span>
            <span style={{ fontFamily: 'var(--font-label)', fontSize: '10px', color: 'var(--editor-text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {activeTool === 'cut' ? 'CUT — Click clip to split at playhead' : 'Select — Drag handles to trim'}
            </span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Drop hint */}
          {timelineDropHover && (
            <span style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: 'var(--vibrant-lime)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Drop to add clip
            </span>
          )}

          {/* Zoom controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--editor-text-dim)', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>zoom_out</span>
            </button>
            <span style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: 'var(--editor-text-dim)', minWidth: '34px', textAlign: 'center' }}>
              {zoom.toFixed(1)}×
            </span>
            <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--editor-text-dim)', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>zoom_in</span>
            </button>
            <button onClick={() => setZoom(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--editor-text-dim)', fontFamily: 'var(--font-label)', fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', marginLeft: '4px' }}>
              FIT
            </button>

            {!showProperties && (
              <button
                onClick={() => setShowProperties(true)}
                style={{ marginLeft: '8px', background: 'none', border: '1px solid var(--editor-border)', cursor: 'pointer', color: 'var(--editor-text-dim)', fontFamily: 'var(--font-label)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '3px 10px' }}
              >
                Inspector
              </button>
            )}
          </div>
        </div>

        {/* Timeline body */}
        <div className="timeline-body">
          {/* Track labels */}
          <div className="timeline-track-labels">
            <div style={{ height: '24px', background: 'var(--editor-bg)', borderBottom: '1px solid var(--editor-border)' }} />
            <div className="timeline-label" style={{ color: '#5a9e3f', height: `${CLIP_H}px` }}>
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>movie</span>VIDEO
            </div>
            <div className="timeline-label" style={{ color: '#3f5a9e', height: `${CLIP_H}px` }}>
              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>audio_file</span>AUDIO
            </div>
          </div>

          {/* Scrollable tracks area */}
          <div
            ref={timelineTracksRef}
            className="timeline-tracks"
            style={{ overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}
            onClick={handleTimelineClick}
          >
            {/* Timecode ruler */}
            <div style={{ width: `${timelineW}px`, height: '24px', background: 'var(--editor-bg)', borderBottom: '1px solid var(--editor-border)', position: 'relative', flexShrink: 0 }}>
              {rulerTicks.map(sec => (
                <div key={sec} style={{ position: 'absolute', left: `${sec * PX_PER_SEC * zoom}px`, top: 0, height: '100%', display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
                  <div style={{ width: '1px', background: 'var(--editor-border)', height: sec % 10 === 0 ? '12px' : '8px', position: 'absolute', bottom: 0 }} />
                  {sec % 5 === 0 && (
                    <span style={{ fontFamily: 'var(--font-label)', fontSize: '9px', color: 'var(--editor-text-dim)', paddingLeft: '3px', lineHeight: '24px', userSelect: 'none' }}>
                      {fmtTime(sec)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Video track */}
            <div
              className="timeline-track video-track"
              style={{ width: `${timelineW}px`, height: `${CLIP_H}px` }}
            >
              {clips.map((clip, i) => {
                const leftPx = clipStartPx(clips, i, zoom);
                const widthPx = Math.max(8, (clip.outPoint - clip.inPoint) * PX_PER_SEC * zoom);
                const isSelected = clip.id === selectedClipId;
                const isActive = i === activeClipIndex;
                const peaks = waveforms.get(clip.id);

                return (
                  <div
                    key={clip.id}
                    id={`clip-${clip.id}`}
                    style={{
                      position: 'absolute',
                      left: `${leftPx}px`,
                      width: `${widthPx}px`,
                      top: '3px',
                      height: `${CLIP_H - 6}px`,
                      background: isSelected ? '#4a7a32' : '#3d6b2a',
                      border: isSelected ? '1px solid var(--vibrant-lime)' : isActive ? '1px solid rgba(166,228,46,0.4)' : '1px solid rgba(255,255,255,0.1)',
                      cursor: activeTool === 'cut' ? 'crosshair' : 'pointer',
                      overflow: 'hidden',
                      userSelect: 'none',
                      display: 'flex', alignItems: 'center',
                      transition: 'border-color 0.1s',
                    }}
                    onClick={e => handleClipClick(e, clip, i)}
                  >
                    {/* Left trim handle */}
                    <div
                      className="clip-handle left"
                      style={{ background: isSelected ? 'rgba(166,228,46,0.8)' : 'rgba(255,255,255,0.3)', zIndex: 5 }}
                      onMouseDown={e => handleTrimMouseDown(e, clip.id, 'left')}
                    />

                    {/* Waveform canvas */}
                    {peaks && widthPx > 20 && (
                      <WaveformCanvas
                        peaks={peaks}
                        width={widthPx}
                        height={CLIP_H - 6}
                        color="rgba(166,228,46,0.35)"
                      />
                    )}

                    {/* Clip label */}
                    <span style={{
                      position: 'absolute', left: '10px', right: '10px',
                      fontFamily: 'var(--font-label)', fontSize: '10px',
                      fontWeight: 600, letterSpacing: '0.04em',
                      color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2,
                    }}>
                      {clip.name}
                    </span>

                    {/* In/out time chips */}
                    {widthPx > 80 && (
                      <div style={{
                        position: 'absolute', bottom: '2px', left: '8px', right: '8px',
                        display: 'flex', justifyContent: 'space-between', pointerEvents: 'none', zIndex: 2,
                      }}>
                        <span style={{ fontFamily: 'var(--font-label)', fontSize: '8px', color: 'rgba(255,255,255,0.5)' }}>{fmtTime(clip.inPoint)}</span>
                        <span style={{ fontFamily: 'var(--font-label)', fontSize: '8px', color: 'rgba(255,255,255,0.5)' }}>{fmtTime(clip.outPoint)}</span>
                      </div>
                    )}

                    {/* Right trim handle */}
                    <div
                      className="clip-handle right"
                      style={{ background: isSelected ? 'rgba(166,228,46,0.8)' : 'rgba(255,255,255,0.3)', zIndex: 5 }}
                      onMouseDown={e => handleTrimMouseDown(e, clip.id, 'right')}
                    />
                  </div>
                );
              })}

              {/* Empty drop hint */}
              {clips.length === 0 && !loadingClips && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-label)', fontSize: '11px', color: 'var(--editor-text-dim)',
                  textTransform: 'uppercase', letterSpacing: '0.08em', gap: '8px',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>drag_indicator</span>
                  Drop video files here or use Add Clips button
                </div>
              )}
            </div>

            {/* Audio track — mirrors video track clips */}
            <div
              className="timeline-track audio-track"
              style={{ width: `${timelineW}px`, height: `${CLIP_H}px` }}
            >
              {clips.map((clip, i) => {
                const leftPx = clipStartPx(clips, i, zoom);
                const widthPx = Math.max(8, (clip.outPoint - clip.inPoint) * PX_PER_SEC * zoom);
                const peaks = waveforms.get(clip.id);
                const isSelected = clip.id === selectedClipId;

                return (
                  <div
                    key={clip.id}
                    style={{
                      position: 'absolute', left: `${leftPx}px`, width: `${widthPx}px`,
                      top: '3px', height: `${CLIP_H - 6}px`,
                      background: isSelected ? '#3d4f8a' : '#2a3d6b',
                      border: isSelected ? '1px solid var(--vibrant-lime)' : '1px solid rgba(255,255,255,0.08)',
                      overflow: 'hidden', cursor: 'pointer',
                    }}
                    onClick={e => handleClipClick(e, clip, i)}
                  >
                    {peaks && widthPx > 12 && (
                      <WaveformCanvas peaks={peaks} width={widthPx} height={CLIP_H - 6} color="rgba(100,150,255,0.6)" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Playhead */}
            <div
              style={{
                position: 'absolute', top: 0, left: `${playheadPx}px`,
                width: '2px', height: '100%',
                background: 'var(--editor-playhead)',
                zIndex: 30, pointerEvents: 'none',
              }}
            >
              {/* Playhead triangle */}
              <div style={{
                position: 'absolute', top: '-1px', left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '8px solid var(--editor-playhead)',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* ━━━ EXPORT MODAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {showExport && (
        <div className="export-modal-overlay" onClick={() => { if (exportState !== 'exporting' && exportState !== 'loading-ffmpeg') setShowExport(false); }}>
          <div className="export-modal" onClick={e => e.stopPropagation()} style={{ color: 'var(--editor-text)' }}>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
              <div>
                <p style={{ fontFamily: 'var(--font-label)', fontSize: '10px', color: 'var(--editor-text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                  EXPORT — {clips.length} CLIP{clips.length !== 1 ? 'S' : ''} · {fmtTime(totalDur)}
                </p>
                <h3 style={{ fontFamily: 'var(--font-headline)', fontSize: '22px', fontWeight: 700, color: 'var(--editor-text)' }}>
                  {projectName}
                </h3>
              </div>
              {exportState !== 'exporting' && exportState !== 'loading-ffmpeg' && (
                <button onClick={() => setShowExport(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--editor-text-dim)', display: 'flex' }}>
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </div>

            {exportState === 'done' ? (
              /* Success */
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: '60px', height: '60px', background: 'var(--vibrant-lime)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '32px', color: '#000' }}>check_circle</span>
                </div>
                <h4 style={{ fontFamily: 'var(--font-headline)', fontSize: '18px', fontWeight: 600, color: 'var(--editor-text)', marginBottom: '8px' }}>Export Complete!</h4>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--editor-text-dim)', marginBottom: '28px' }}>
                  Your video has been rendered as {exportFormat.toUpperCase()} · {exportQuality} quality
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <a
                    href={exportUrl!}
                    download={`${projectName}.${exportFormat}`}
                    style={{
                      background: 'var(--vibrant-lime)', color: '#000',
                      fontFamily: 'var(--font-button)', fontSize: '13px', fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      padding: '12px 28px', textDecoration: 'none',
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
                    Download
                  </a>
                  <button
                    onClick={() => { setShowExport(false); setExportState('idle'); }}
                    style={{
                      background: 'none', border: '1px solid var(--editor-border-light)', color: 'var(--editor-text)',
                      fontFamily: 'var(--font-button)', fontSize: '13px', fontWeight: 600,
                      letterSpacing: '0.08em', textTransform: 'uppercase', padding: '12px 28px', cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>

            ) : exportState === 'error' ? (
              /* Error */
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ff5555', display: 'block', marginBottom: '16px' }}>error</span>
                <h4 style={{ fontFamily: 'var(--font-headline)', fontSize: '16px', fontWeight: 600, color: '#ff5555', marginBottom: '8px' }}>Export Failed</h4>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--editor-text-dim)', marginBottom: '24px' }}>
                  {ffmpeg.error || 'An unexpected error occurred. Check the console for details.'}
                </p>
                <button
                  onClick={() => setExportState('idle')}
                  style={{
                    background: 'none', border: '1px solid var(--editor-border-light)', color: 'var(--editor-text)',
                    fontFamily: 'var(--font-button)', fontSize: '13px', cursor: 'pointer',
                    padding: '10px 24px', letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}
                >
                  Try Again
                </button>
              </div>

            ) : exportState === 'loading-ffmpeg' || exportState === 'exporting' ? (
              /* Progress */
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 0.08}s`, width: '4px' }} />
                    ))}
                  </div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--editor-text)' }}>
                    {exportStage || ffmpeg.stage || 'Processing…'}
                  </p>
                </div>
                <div style={{ height: '4px', background: 'var(--editor-surface-mid)', overflow: 'hidden', marginBottom: '8px' }}>
                  <div style={{
                    height: '100%', background: 'var(--vibrant-lime)',
                    width: `${Math.max(exportProgress, ffmpeg.progress)}%`,
                    transition: 'width 0.3s linear',
                  }} />
                </div>
                <p style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: 'var(--editor-text-dim)', textAlign: 'right' }}>
                  {Math.max(exportProgress, ffmpeg.progress)}%
                </p>
              </div>

            ) : (
              /* Format selection */
              <>
                {/* Format cards */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                  {[
                    { id: 'mp4' as const, label: 'MP4', desc: 'H.264 · Max compatibility' },
                    { id: 'webm' as const, label: 'WebM', desc: 'VP9 · Smaller file size' },
                  ].map(fmt => (
                    <div
                      key={fmt.id}
                      id={`export-format-${fmt.id}`}
                      className={`format-card${exportFormat === fmt.id ? ' selected' : ''}`}
                      onClick={() => setExportFormat(fmt.id)}
                    >
                      <p style={{ fontFamily: 'var(--font-headline)', fontSize: '16px', fontWeight: 700, color: exportFormat === fmt.id ? 'var(--vibrant-lime)' : 'var(--editor-text)', marginBottom: '4px' }}>
                        {fmt.label}
                      </p>
                      <p style={{ fontFamily: 'var(--font-label)', fontSize: '10px', color: 'var(--editor-text-dim)', letterSpacing: '0.04em' }}>{fmt.desc}</p>
                    </div>
                  ))}
                </div>

                {/* Quality */}
                <div style={{ marginBottom: '24px' }}>
                  <p className="prop-label" style={{ color: 'var(--editor-text-dim)', marginBottom: '10px' }}>QUALITY</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['high', 'medium', 'low'] as const).map(q => (
                      <button
                        key={q}
                        id={`export-quality-${q}`}
                        onClick={() => setExportQuality(q)}
                        style={{
                          flex: 1, padding: '8px',
                          background: exportQuality === q ? 'rgba(166,228,46,0.1)' : 'none',
                          border: `1px solid ${exportQuality === q ? 'var(--vibrant-lime)' : 'var(--editor-border-light)'}`,
                          color: exportQuality === q ? 'var(--vibrant-lime)' : 'var(--editor-text-dim)',
                          fontFamily: 'var(--font-label)', fontSize: '11px', textTransform: 'uppercase',
                          letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.15s',
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div style={{ padding: '14px', background: 'var(--editor-surface-mid)', border: '1px solid var(--editor-border)', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span className="prop-label" style={{ color: 'var(--editor-text-dim)' }}>Clips to export</span>
                    <span style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: 'var(--editor-text)' }}>{clips.length}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span className="prop-label" style={{ color: 'var(--editor-text-dim)' }}>Total duration</span>
                    <span style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: 'var(--editor-text)' }}>{fmtTime(totalDur)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="prop-label" style={{ color: 'var(--editor-text-dim)' }}>Engine</span>
                    <span style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: ffmpeg.loaded ? 'var(--vibrant-lime)' : 'var(--editor-text-dim)' }}>
                      {ffmpeg.loaded ? '✓ FFmpeg loaded' : 'Will load FFmpeg'}
                    </span>
                  </div>
                </div>

                {/* Export button */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    id="start-export-btn"
                    onClick={handleExport}
                    style={{
                      flex: 1, background: 'var(--vibrant-lime)', color: '#000', border: 'none',
                      fontFamily: 'var(--font-button)', fontSize: '13px', fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase', padding: '14px 24px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>movie_creation</span>
                    Render & Export
                  </button>
                  <button
                    onClick={() => setShowExport(false)}
                    style={{
                      background: 'none', border: '1px solid var(--editor-border-light)', color: 'var(--editor-text)',
                      fontFamily: 'var(--font-button)', fontSize: '13px', cursor: 'pointer',
                      letterSpacing: '0.08em', textTransform: 'uppercase', padding: '14px 24px',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const WaveformCanvas: React.FC<{
  peaks: Float32Array;
  width: number;
  height: number;
  color: string;
}> = ({ peaks, width, height, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;

    const barW = width / peaks.length;
    const mid = height / 2;

    for (let i = 0; i < peaks.length; i++) {
      const amp = peaks[i] * mid * 0.9;
      ctx.fillRect(i * barW, mid - amp, Math.max(1, barW - 0.5), amp * 2);
    }
  }, [peaks, width, height, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
};

export default VideoEditor;

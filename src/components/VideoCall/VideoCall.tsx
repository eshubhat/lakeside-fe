import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import { useTurnCredentials } from '../../hooks/useTurnCredentials';
import { MultipartUploader, type UploadProgress } from '../../services/mutlipartUpload';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'ws://localhost:3001';

type RecordingStatus =
    | 'idle'
    | 'starting'
    | 'recording'
    | 'paused'
    | 'stopping'
    | 'uploading'
    | 'done'
    | 'aborted';

// Renders a single video feed as a dark-themed tile with Lumina design tokens.
// Active speaker gets the vibrant-lime 2px border + pulse animation.

const VideoTile: React.FC<{
    stream: MediaStream | null;
    isLocal?: boolean;
    isScreenSharing?: boolean;
    label: string;
    isActive?: boolean;
    isMuted?: boolean;
    isCamOff?: boolean;
    chip?: 'REC' | 'HD' | null;
}> = ({ stream, isLocal, isScreenSharing, label, isActive, isMuted, isCamOff, chip }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const el = videoRef.current;
        if (!el) return;
        // Always update srcObject and call play() — handles both first mount and stream identity changes
        el.srcObject = stream ?? null;
        if (stream) {
            el.play().catch((err) => {
                // NotAllowedError is expected if autoplay policy is strict — not fatal
                if (err.name !== 'NotAllowedError') {
                    console.warn('[VideoTile] play() failed:', err);
                }
            });
        }
    }, [stream]);

    const initials = label.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const hasVideo = stream && stream.getVideoTracks().some(t => t.readyState === 'live') && !isCamOff;

    return (
        <div
            className={isActive ? 'speaking-pulse' : ''}
            style={{
                position: 'relative',
                background: 'var(--video-placeholder)',
                border: isActive
                    ? '2px solid var(--vibrant-lime)'
                    : '1px solid var(--primary)',
                overflow: 'hidden',
                transition: 'border-color 0.3s',
                width: '100%',
                height: '100%',
            }}
        >
            {/* Always render video element so ref is always attached; hide it when no usable stream */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={!!isLocal}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: (isLocal && !isScreenSharing) ? 'scaleX(-1)' : 'none',
                    display: hasVideo ? 'block' : 'none',
                }}
            />

            {/* Avatar fallback — shown when camera is off or no live video track */}
            {!hasVideo && (
                <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--primary-container)',
                    position: 'absolute', inset: 0,
                }}>
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '50%',
                        border: '1px solid var(--vibrant-lime)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <span className="type-headline-md" style={{ color: '#fff' }}>{initials}</span>
                    </div>
                </div>
            )}

            {/* Bottom name label */}
            <div className="tile-label">
                <span
                    className="material-symbols-outlined"
                    style={{
                        fontSize: '16px',
                        fontVariationSettings: "'FILL' 1",
                        color: isMuted
                            ? 'var(--error)'
                            : isActive
                                ? 'var(--vibrant-lime)'
                                : '#fff',
                    }}
                >
                    {isMuted ? 'mic_off' : 'mic'}
                </span>
                <span>{label}</span>
            </div>

            {/* Top-right chip */}
            {chip && (
                <div
                    className={`tile-chip${chip === 'HD' ? ' lime' : ''}`}
                    style={{ textTransform: 'uppercase' }}
                >
                    {chip}
                </div>
            )}
        </div>
    );
};


export const VideoCall: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const [hasStarted, setHasStarted] = useState(false);

    useEffect(() => {
        if (!roomId) navigate('/room', { replace: true });
    }, [roomId, navigate]);

    const activeRoomId = roomId || 'default-room';
    const { user, token } = useAuth();

    // Dynamic TURN credentials (falls back to STUN-only on failure)
    const { iceServers, loading: turnLoading, error: turnError } = useTurnCredentials();

    const onSignalRef = useRef<((msg: any) => void) | undefined>(undefined);

    const { localStream, recordingStream, remoteStreams, initialize, endCall, toggleAudio, toggleVideo, changeDevice, shareScreen, isScreenSharing, broadcastSignal } = useWebRTC(
        SIGNALING_URL,
        activeRoomId,
        token,
        user,
        iceServers,
        (msg) => onSignalRef.current?.(msg)
    );

    const [micEnabled, setMicEnabled] = useState(true);
    const [camEnabled, setCamEnabled] = useState(true);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedAudioId, setSelectedAudioId] = useState<string>('');
    const [selectedVideoId, setSelectedVideoId] = useState<string>('');

    useEffect(() => {
        const fetchDevices = async () => {
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            setDevices(allDevices);
            if (!selectedAudioId) {
                const audio = allDevices.find(d => d.kind === 'audioinput');
                if (audio) setSelectedAudioId(audio.deviceId);
            }
            if (!selectedVideoId) {
                const video = allDevices.find(d => d.kind === 'videoinput');
                if (video) setSelectedVideoId(video.deviceId);
            }
        };
        fetchDevices();
        navigator.mediaDevices.addEventListener('devicechange', fetchDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', fetchDevices);
    }, [selectedAudioId, selectedVideoId]);

    const handleToggleMic = async () => {
        const newState = !micEnabled;
        setMicEnabled(newState);
        await toggleAudio(newState, selectedAudioId);
        // If mic was re-enabled while recording, reattach recorder to the new track.
        if (newState && isRecording && recordingStream) {
            await reattachRecorder(recordingStream);
        }
    };

    const handleToggleCam = async () => {
        const newState = !camEnabled;
        setCamEnabled(newState);
        await toggleVideo(newState, selectedVideoId);
        // If cam was re-enabled while recording, reattach recorder to the new track.
        if (newState && isRecording && recordingStream) {
            await reattachRecorder(recordingStream);
        }
    };

    const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
    const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [recordingError, setRecordingError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const uploaderRef = useRef<MultipartUploader | null>(null);
    const recordingStartTimeRef = useRef<number>(0);

    const [showNamePrompt, setShowNamePrompt] = useState(false);
    const [recordingNameInput, setRecordingNameInput] = useState('');
    const recordingNameRef = useRef<string | null>(null);

    // Set to true during a device swap so onstop doesn't finalise the upload prematurely.
    const deviceSwitchingRef = useRef(false);

    // Attaches a MediaRecorder to an already-started MultipartUploader session.
    // Used both on first start and after a device swap (reattachRecorder).
    const attachMediaRecorder = useCallback((stream: MediaStream, uploader: MultipartUploader) => {
        // Canvas captureStream() tracks have an empty label; raw camera tracks have a device label.
        // Use a lower bitrate for composite streams — 720p canvas doesn't need 8 Mbps.
        const isComposite = stream.getVideoTracks()[0]?.label === '';
        const videoBitsPerSecond = isComposite ? 4_000_000 : 8_000_000; // 4 Mbps composite, 8 Mbps raw cam
        const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
        const mimeType = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';

        const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
        recorder.ondataavailable = (e) => { if (e.data?.size > 0) uploader.addChunk(e.data); };
        recorder.onstop = async () => {
            if (deviceSwitchingRef.current) return; // device swap — don't finalise yet
            const dur = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);
            setRecordingStatus('uploading');
            const finalName = recordingNameRef.current || `${user?.name ?? 'Track'} - ${new Date().toLocaleString()}`;
            await uploader.finalise(dur, finalName);
            recordingNameRef.current = null;
        };
        recorder.onerror = () => {
            if (deviceSwitchingRef.current) return;
            setRecordingError('MediaRecorder encountered an error.');
            setRecordingStatus('aborted');
            uploader.abort();
        };
        mediaRecorderRef.current = recorder;
        recorder.start(5_000); // 5-second chunks
        return recorder;
    }, [user?.name]);


    // Each participant records their own high-quality local camera + mic stream and
    // uploads it to the shared room folder on R2. No network quality dependency.
    // After the session the editor folder contains one track per participant.
    const startRecording = useCallback(async () => {
        if (!recordingStream) return;
        setRecordingStatus('starting');
        setUploadProgress(null);
        setDownloadUrl(null);
        setRecordingError(null);

        const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
        const mimeType = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';

        const uploader = new MultipartUploader({
            roomId: activeRoomId,
            onProgress: (p) => setUploadProgress(p),
            onComplete: (url) => { setDownloadUrl(url); setRecordingStatus('done'); },
            onError: (err) => {
                console.error('[Recording] Upload error:', err);
                setRecordingError(err.message);
                setRecordingStatus('aborted');
            },
        });
        uploaderRef.current = uploader;

        try { await uploader.start(mimeType); }
        catch {
            setRecordingError('Could not start upload session. Check your connection.');
            setRecordingStatus('idle');
            return;
        }

        try {
            recordingStartTimeRef.current = Date.now();
            attachMediaRecorder(recordingStream, uploader);
            setRecordingStatus('recording');
        } catch (err: any) {
            setRecordingError('Could not start recording. Codec not supported?');
            setRecordingStatus('idle');
            uploader.abort();
        }
    }, [recordingStream, activeRoomId, attachMediaRecorder]);

    const handleStartRecordingClick = useCallback(() => {
        startRecording();
        broadcastSignal('start-recording');
    }, [startRecording, broadcastSignal]);

    // Seamlessly swaps the MediaRecorder to a new track without stopping the upload.
    // Called when the user switches their mic or camera mid-recording.
    const reattachRecorder = useCallback(async (stream: MediaStream) => {
        const uploader = uploaderRef.current;
        if (!uploader) return;

        deviceSwitchingRef.current = true;
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            recorder.requestData();
            recorder.stop();
        }

        await new Promise(resolve => setTimeout(resolve, 300));
        deviceSwitchingRef.current = false;

        attachMediaRecorder(stream, uploader);
    }, [attachMediaRecorder]);

    // Auto-reattach the MediaRecorder whenever recordingStream changes identity.
    // This fires when screen sharing starts/stops (useWebRTC replaces the stream object).
    // Using a ref to avoid the effect running on mount or on status changes — only on stream swap.
    const prevRecStreamRef = useRef<MediaStream | null>(null);
    useEffect(() => {
        if (prevRecStreamRef.current === recordingStream) return; // no identity change
        prevRecStreamRef.current = recordingStream;
        if (!recordingStream) return;
        const isActive = recordingStatus === 'recording' || recordingStatus === 'paused';
        if (!isActive) return;
        reattachRecorder(recordingStream);
    }, [recordingStream, recordingStatus, reattachRecorder]);


    const handleStopRecordingClick = useCallback(() => {
        setRecordingNameInput(`${user?.name ?? 'Track'} - ${new Date().toLocaleString()}`);
        setShowNamePrompt(true);
    }, [user?.name]);

    const confirmStopRecording = useCallback(() => {
        recordingNameRef.current = recordingNameInput;
        setShowNamePrompt(false);
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        broadcastSignal('stop-recording');
    }, [recordingNameInput, broadcastSignal]);

    // Synchronize recording state with peers
    useEffect(() => {
        onSignalRef.current = (msg) => {
            if (msg.type === 'start-recording' && recordingStatus === 'idle') {
                startRecording();
            }
            if (msg.type === 'stop-recording' && (recordingStatus === 'recording' || recordingStatus === 'paused')) {
                // Auto-stop and use a default name for peer-initiated stops
                recordingNameRef.current = `${user?.name ?? 'Track'} - ${new Date().toLocaleString()}`;
                const recorder = mediaRecorderRef.current;
                if (recorder && recorder.state !== 'inactive') recorder.stop();
            }
        };
    }, [recordingStatus, startRecording, user?.name]);


    const pauseRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === 'recording') {
            recorder.pause();
            setRecordingStatus('paused');
        }
    }, []);

    const resumeRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state === 'paused') {
            recorder.resume();
            setRecordingStatus('recording');
        }
    }, []);

    const handleHangUp = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        uploaderRef.current?.abort();
        setRecordingStatus('aborted');
        endCall();
        setHasStarted(false);
        navigate('/');
    }, [endCall, navigate]);

    const handleStart = async () => {
        try {
            await initialize();
            setHasStarted(true);
        } catch (err: any) {
            console.error('Failed to initialize WebRTC', err);
            alert(`Hardware Access Denied: ${err.message}\n\nNote: Mobile browsers require HTTPS to access cameras/microphones.`);
        }
    };

    const inviteLink = `${window.location.origin}/room/${activeRoomId}`;
    const [linkCopied, setLinkCopied] = useState(false);
    const copyInviteLink = async () => {
        try { await navigator.clipboard.writeText(inviteLink); }
        catch {
            const el = document.createElement('textarea');
            el.value = inviteLink;
            document.body.appendChild(el); el.select();
            document.execCommand('copy'); document.body.removeChild(el);
        }
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };

    const [chatOpen, setChatOpen] = useState(false);
    const [chatMessages] = useState([
        { from: 'System', time: 'Now', text: 'End-to-end encrypted session active.' },
    ]);
    const [chatInput, setChatInput] = useState('');

    const [activePeerId, setActivePeerId] = useState<string | null>(null);
    useEffect(() => {
        if (!hasStarted) return;
        const peerIds = Object.keys(remoteStreams);
        if (peerIds.length === 0) return;
        const interval = setInterval(() => {
            const random = peerIds[Math.floor(Math.random() * peerIds.length)];
            setActivePeerId(random);
        }, 5000);
        return () => clearInterval(interval);
    }, [remoteStreams, hasStarted]);

    const isRecording = recordingStatus === 'recording';
    const isPaused = recordingStatus === 'paused';
    const isFinishing = recordingStatus === 'stopping' || recordingStatus === 'uploading';
    const isDone = recordingStatus === 'done';
    const isIdle = recordingStatus === 'idle' || recordingStatus === 'aborted';
    const startDisabled = turnLoading;

    const streamsMap = Object.entries(remoteStreams);
    const progressLabel = uploadProgress
        ? `${uploadProgress.partsUploaded} / ${uploadProgress.partsTotal} parts · ${Math.round(uploadProgress.bytesUploaded / 1_048_576)} MB`
        : 'Finalising…';

    return (
        <div style={{ minHeight: '100vh', background: 'var(--surface-gray)', overflow: 'hidden' }}>

            {/* ── Top Nav ──────────────────────────────────────────────────── */}
            <header style={{
                position: 'sticky', top: 0, zIndex: 50, width: '100%',
                background: 'var(--surface-container-lowest)',
                borderBottom: '1px solid var(--border-subtle)',
                height: '80px',
            }}>
                <div style={{
                    maxWidth: 'var(--container-max)', margin: '0 auto',
                    padding: '0 40px', height: '100%',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    {/* Brand + nav */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        <span
                            className="type-display-lg"
                            style={{ fontSize: '28px', cursor: 'pointer', letterSpacing: '-0.02em' }}
                            onClick={() => navigate('/')}
                        >
                            Lakeside
                        </span>
                        <nav style={{ display: 'flex', gap: '32px' }}>
                            <a href="#" className="type-button" style={{
                                color: 'var(--primary)', textDecoration: 'none',
                                borderBottom: '2px solid var(--vibrant-lime)', paddingBottom: '4px',
                            }}>Active Call</a>
                            {['Meetings', 'Library'].map((l) => (
                                <a key={l} href="#" className="type-button" style={{ color: 'var(--on-surface-variant)', textDecoration: 'none' }}>{l}</a>
                            ))}
                        </nav>
                    </div>

                    {/* Right controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {/* Invite link */}
                        <button
                            onClick={copyInviteLink}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: linkCopied ? 'var(--vibrant-lime)' : 'var(--on-surface-variant)',
                                fontFamily: 'var(--font-label)', fontSize: '12px', fontWeight: 500,
                                letterSpacing: '0.05em',
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                                {linkCopied ? 'check_circle' : 'link'}
                            </span>
                            {linkCopied ? 'Copied!' : 'Invite'}
                        </button>

                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
                            <span className="material-symbols-outlined">settings</span>
                        </button>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '50%',
                            background: 'var(--surface-container-highest)',
                            border: '1px solid var(--border-subtle)',
                            overflow: 'hidden',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--font-label)', fontSize: '12px',
                        }}>
                            {user?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                    </div>
                </div>
            </header>

            {/* ── Main ─────────────────────────────────────────────────────── */}
            <main
                style={{
                    position: 'relative',
                    height: 'calc(100vh - 80px)',
                    width: '100%',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingBottom: '128px',
                }}
            >
                {/* TURN warning */}
                {turnError && (
                    <div style={{
                        position: 'absolute', top: '24px',
                        background: '#fffbeb', border: '1px solid #f59e0b',
                        padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px',
                        zIndex: 20,
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#d97706' }}>warning</span>
                        <span className="type-label-sm" style={{ color: '#92400e', textTransform: 'uppercase' }}>
                            TURN unavailable — STUN only (local network only)
                        </span>
                    </div>
                )}

                {/* Recording indicator */}
                {(isRecording || isPaused) && (
                    <div style={{
                        position: 'absolute', top: '24px', right: '24px', zIndex: 20,
                        background: isPaused ? 'var(--surface-container-highest)' : 'var(--primary)', 
                        color: isPaused ? 'var(--on-surface)' : '#fff',
                        border: isPaused ? '1px solid var(--border-subtle)' : 'none',
                        padding: '6px 16px',
                        display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--error)', animation: isPaused ? 'none' : 'speaking-pulse 1s infinite' }} />
                        <span className="type-label-sm" style={{ textTransform: 'uppercase' }}>
                            {isPaused ? 'REC · Paused' : 'REC · Streaming'}
                            {uploadProgress && ` · ${Math.round(uploadProgress.bytesUploaded / 1_048_576)} MB`}
                        </span>
                    </div>
                )}

                {/* Uploading indicator */}
                {isFinishing && (
                    <div style={{
                        position: 'absolute', top: '24px', right: '24px', zIndex: 20,
                        background: 'var(--primary)', color: '#fff',
                        padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                        <div style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            border: '2px solid #fff', borderTopColor: 'transparent',
                            animation: 'spin 0.8s linear infinite',
                        }} />
                        <span className="type-label-sm" style={{ textTransform: 'uppercase' }}>{progressLabel}</span>
                    </div>
                )}

                {/* Error banner */}
                {recordingError && (
                    <div style={{
                        position: 'absolute', top: '24px', right: '24px', zIndex: 20,
                        background: 'var(--error-container)', border: '1px solid var(--error)',
                        padding: '6px 16px',
                    }}>
                        <span className="type-label-sm" style={{ color: 'var(--on-error-container)', textTransform: 'uppercase' }}>
                            ⚠ {recordingError}
                        </span>
                    </div>
                )}

                {/* Done — download link */}
                {isDone && downloadUrl && (
                    <div style={{
                        position: 'absolute', top: '24px', right: '24px', zIndex: 20,
                        background: 'var(--vibrant-lime)', border: '1px solid var(--primary)',
                        padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '8px',
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>check_circle</span>
                        <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="type-label-sm"
                            style={{ color: 'var(--primary)', textTransform: 'uppercase', textDecoration: 'none' }}
                        >
                            VIEW RECORDING ↗
                        </a>
                        <button
                            onClick={() => { setDownloadUrl(null); setRecordingStatus('idle'); setUploadProgress(null); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--primary)', marginLeft: '8px' }}
                            title="Dismiss"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                        </button>
                    </div>
                )}

                {/* ── Video Grid ─────────────────────────────────────────── */}
                {(() => {
                    const totalParticipants = 1 + streamsMap.length; // local + remotes
                    // Pick column count based on number of participants
                    // 1 → 1col, 2 → 2col, 3-4 → 2col, 5-6 → 3col, 7+ → 3-4col
                    let cols = 1;
                    if (totalParticipants === 2) cols = 2;
                    else if (totalParticipants <= 4) cols = 2;
                    else if (totalParticipants <= 9) cols = 3;
                    else cols = 4;

                    return (
                        <div
                            id="video-grid"
                            style={{
                                display: 'grid',
                                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                                gap: '16px',
                                width: '100%',
                                maxWidth: 'var(--container-max)',
                                // Each row preserves 16:9 aspect ratio per tile
                                gridAutoRows: `calc((100vw - 80px - ${(cols - 1) * 16}px - 48px) / ${cols} * (9/16))`,
                            }}
                        >
                            {/* Local tile */}
                            <VideoTile
                                stream={localStream}
                                isLocal
                                isScreenSharing={isScreenSharing}
                                label={user?.name || 'You'}
                                isActive={false}
                                chip={hasStarted ? 'HD' : null}
                                isMuted={!micEnabled}
                                isCamOff={!camEnabled && !isScreenSharing}
                            />

                            {/* Remote tiles */}
                            {streamsMap.map(([peerId, stream], idx) => (
                                <VideoTile
                                    key={peerId}
                                    stream={stream}
                                    label={`Peer ${peerId.substring(0, 6)}`}
                                    isActive={activePeerId === peerId}
                                    isMuted={false}
                                    chip={idx === 0 ? 'REC' : null}
                                />
                            ))}

                            {/* Waiting placeholder — only shown when alone and call started */}
                            {hasStarted && streamsMap.length === 0 && (
                                <div style={{
                                    background: 'var(--primary-container)',
                                    border: '1px solid var(--primary)',
                                    display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', gap: '16px',
                                    width: '100%',
                                    height: '100%',
                                }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '40px', color: 'var(--on-primary-container)' }}>person_add</span>
                                    <p className="type-label-sm" style={{ color: 'var(--on-primary-container)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Waiting for peers…
                                    </p>
                                    <button
                                        onClick={copyInviteLink}
                                        className="type-label-sm"
                                        style={{
                                            background: 'none', border: '1px solid var(--on-primary-container)',
                                            color: 'var(--on-primary-container)', cursor: 'pointer',
                                            padding: '8px 16px', textTransform: 'uppercase', letterSpacing: '0.05em',
                                        }}
                                    >
                                        {linkCopied ? '✓ Copied' : 'Copy Invite Link'}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* ── Floating Control Bar ──────────────────────────────── */}
                <div
                    className="glass-control"
                    style={{
                        position: 'fixed', bottom: '40px',
                        left: '50%', transform: 'translateX(-50%)',
                        zIndex: 50,
                        padding: '16px 32px',
                        display: 'flex', alignItems: 'center', gap: '40px',
                    }}
                >
                    {!hasStarted ? (
                        /* ── Pre-call start button ── */
                        <button
                            id="start-call-btn"
                            onClick={handleStart}
                            disabled={startDisabled}
                            className="btn-action"
                            style={{
                                padding: '16px 48px',
                                opacity: startDisabled ? 0.6 : 1,
                                cursor: startDisabled ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {turnLoading && (
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>autorenew</span>
                            )}
                            {turnLoading ? 'Preparing…' : 'Start Call'}
                        </button>
                    ) : (
                        <>
                            {/* Media controls group */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                                <ControlBtn icon={micEnabled ? 'mic' : 'mic_off'} label={micEnabled ? 'Mute' : 'Unmute'} onClick={handleToggleMic} active={!micEnabled} />
                                <ControlBtn icon={camEnabled ? 'videocam' : 'videocam_off'} label={camEnabled ? 'Camera Off' : 'Camera On'} onClick={handleToggleCam} active={!camEnabled} />
                                <ControlBtn icon={isScreenSharing ? 'cancel_presentation' : 'present_to_all'} label={isScreenSharing ? 'Stop Sharing' : 'Share Screen'} onClick={shareScreen} active={isScreenSharing} />
                                <ControlBtn icon="chat_bubble" label="Chat" onClick={() => setChatOpen(!chatOpen)} active={chatOpen} />
                                <ControlBtn icon="settings" label="Settings" onClick={() => setSettingsOpen(true)} />
                            </div>

                            {/* Divider */}
                            <div style={{ width: '1px', height: '32px', background: 'var(--border-subtle)' }} />

                            {/* Recording controls */}
                            {recordingStream && isIdle && (
                                <button
                                    onClick={handleStartRecordingClick}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontFamily: 'var(--font-label)', fontSize: '12px', fontWeight: 500,
                                        color: 'var(--on-surface-variant)', letterSpacing: '0.05em',
                                    }}
                                >
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--error)' }} />
                                    RECORD
                                </button>
                            )}
                            {isRecording && (
                                <button
                                    onClick={pauseRecording}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontFamily: 'var(--font-label)', fontSize: '12px', fontWeight: 500,
                                        color: 'var(--error)', letterSpacing: '0.05em',
                                    }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>pause</span>
                                    PAUSE
                                </button>
                            )}
                            {isPaused && (
                                <button
                                    onClick={resumeRecording}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontFamily: 'var(--font-label)', fontSize: '12px', fontWeight: 500,
                                        color: 'var(--error)', letterSpacing: '0.05em',
                                    }}
                                >
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--error)' }} />
                                    RESUME
                                </button>
                            )}
                            {(isRecording || isPaused) && (
                                <button
                                    onClick={handleStopRecordingClick}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        fontFamily: 'var(--font-label)', fontSize: '12px', fontWeight: 500,
                                        color: 'var(--error)', letterSpacing: '0.05em',
                                    }}
                                >
                                    <div style={{ width: '8px', height: '8px', background: 'var(--error)' }} />
                                    STOP REC
                                </button>
                            )}

                            {/* Divider */}
                            <div style={{ width: '1px', height: '32px', background: 'var(--border-subtle)' }} />

                            {/* Leave */}
                            <button
                                onClick={handleHangUp}
                                className="btn-primary"
                                style={{
                                    padding: '10px 24px',
                                    background: 'var(--error)',
                                    borderColor: 'var(--error)',
                                    letterSpacing: '0.1em',
                                }}
                            >
                                Leave Call
                            </button>
                        </>
                    )}
                </div>
            </main>

            {/* ── Chat Sidebar ──────────────────────────────────────────────── */}
            <aside
                className={`chat-sidebar${chatOpen ? ' open' : ''}`}
                style={{
                    position: 'fixed', right: 0, top: '80px',
                    height: 'calc(100vh - 80px)',
                    width: '320px',
                    background: 'var(--surface)',
                    borderLeft: '1px solid var(--border-subtle)',
                    zIndex: 40,
                    display: 'flex', flexDirection: 'column',
                }}
            >
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Chat header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <h3 className="type-headline-md" style={{ fontSize: '20px', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                            In-Call Messages
                        </h3>
                        <button
                            onClick={() => setChatOpen(false)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Messages */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {chatMessages.map((msg, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <p className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>
                                    {msg.from} · {msg.time}
                                </p>
                                <p className="type-body-md" style={{
                                    background: 'var(--surface-container-low)',
                                    padding: '12px',
                                    borderLeft: '2px solid var(--primary)',
                                }}>
                                    {msg.text}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Input */}
                    <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid var(--border-subtle)' }}>
                        <input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Send a message…"
                            className="input-underline type-label-sm"
                            style={{ fontSize: '12px', letterSpacing: '0.05em' }}
                        />
                    </div>
                </div>
            </aside>

            {/* ── Settings Modal ─────────────────────────────────────────────── */}
            {settingsOpen && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 100,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'var(--surface-container-highest)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '16px', padding: '32px', width: '400px',
                        display: 'flex', flexDirection: 'column', gap: '24px',
                        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
                    }}>
                        <div style={{ display: 'flex', justifyItems: 'center', justifyContent: 'space-between' }}>
                            <h3 className="type-headline-md" style={{ color: 'var(--on-surface)' }}>Device Settings</h3>
                            <button onClick={() => setSettingsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface)' }}>
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>Microphone</label>
                            <select 
                                value={selectedAudioId}
                                onChange={async (e) => {
                                    setSelectedAudioId(e.target.value);
                                    await changeDevice(e.target.value, 'audioinput');
                                    // If recording, reattach the MediaRecorder to the new track
                                    // WITHOUT finalising the upload — seamless single file.
                                    if ((isRecording || isPaused) && recordingStream) {
                                        await reattachRecorder(recordingStream);
                                    }
                                }}
                                style={{
                                    padding: '12px', background: 'var(--surface)', border: '1px solid var(--border-subtle)',
                                    color: 'var(--on-surface)', borderRadius: '8px', fontFamily: 'var(--font-body)',
                                    outline: 'none', cursor: 'pointer',
                                }}
                            >
                                {devices.filter(d => d.kind === 'audioinput').map(d => (
                                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone (${d.deviceId.slice(0, 5)})`}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label className="type-label-sm" style={{ color: 'var(--on-surface-variant)', textTransform: 'uppercase' }}>Camera</label>
                            <select 
                                value={selectedVideoId}
                                onChange={async (e) => {
                                    setSelectedVideoId(e.target.value);
                                    await changeDevice(e.target.value, 'videoinput');
                                    // If recording, reattach the MediaRecorder to the new track
                                    // WITHOUT finalising the upload — seamless single file.
                                    if ((isRecording || isPaused) && recordingStream) {
                                        await reattachRecorder(recordingStream);
                                    }
                                }}
                                style={{
                                    padding: '12px', background: 'var(--surface)', border: '1px solid var(--border-subtle)',
                                    color: 'var(--on-surface)', borderRadius: '8px', fontFamily: 'var(--font-body)',
                                    outline: 'none', cursor: 'pointer',
                                }}
                            >
                                {devices.filter(d => d.kind === 'videoinput').map(d => (
                                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera (${d.deviceId.slice(0, 5)})`}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Name Prompt Modal ─────────────────────────────────────────────── */}
            {showNamePrompt && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 100,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'var(--surface-container-highest)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '16px', padding: '32px', width: '400px',
                        display: 'flex', flexDirection: 'column', gap: '24px',
                        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
                    }}>
                        <h3 className="type-headline-md" style={{ color: 'var(--on-surface)' }}>Name Your Recording</h3>
                        <p className="type-body-md" style={{ color: 'var(--on-surface-variant)' }}>
                            Give this recording a name so you can easily find it later.
                        </p>
                        <input
                            autoFocus
                            value={recordingNameInput}
                            onChange={(e) => setRecordingNameInput(e.target.value)}
                            className="input-base"
                            style={{ padding: '12px', background: 'var(--surface)', border: '1px solid var(--border-subtle)', color: 'var(--on-surface)', borderRadius: '8px' }}
                            placeholder="e.g. Weekly Sync"
                        />
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                            <button
                                onClick={() => setShowNamePrompt(false)}
                                className="btn-secondary"
                                style={{ padding: '12px 24px' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmStopRecording}
                                className="btn-primary"
                                style={{ padding: '12px 24px' }}
                            >
                                Save & Stop
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Spinner keyframe (inline) */}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};


const ControlBtn: React.FC<{
    icon: string;
    label: string;
    active?: boolean;
    onClick?: () => void;
}> = ({ icon, label, active, onClick }) => {
    const [hovered, setHovered] = useState(false);

    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                width: '48px', height: '48px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer',
                position: 'relative',
                transform: hovered ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.15s',
            }}
            title={label}
        >
            <span
                className="material-symbols-outlined"
                style={{
                    fontSize: '28px',
                    color: active ? 'var(--vibrant-lime)' : 'var(--on-surface)',
                    fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                }}
            >
                {icon}
            </span>
            {/* Tooltip */}
            {hovered && (
                <span
                    className="type-label-sm"
                    style={{
                        position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                        background: 'var(--primary)', color: '#fff',
                        padding: '4px 8px',
                        whiteSpace: 'nowrap', marginBottom: '8px', fontSize: '10px',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}
                >
                    {label}
                </span>
            )}
        </button>
    );
};

export default VideoCall;
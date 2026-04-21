import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import { Check, Link2, Video } from 'lucide-react';
import { MultipartUploader, type UploadProgress } from '../../services/mutlipartUpload';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'ws://localhost:3001';

// ─── VideoPlayer ──────────────────────────────────────────────────────────────

const VideoPlayer: React.FC<{ stream: MediaStream | null; isLocal?: boolean; label: string }> = ({
    stream,
    isLocal,
    label,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream ?? null;
        }
    }, [stream]);

    if (!stream && !isLocal) {
        return (
            <div className="bg-white rounded-3xl shadow-xl border border-midnight/5 aspect-video flex flex-col items-center justify-center text-on-surface-variant gap-4 min-h-[200px] w-full">
                <div className="flex gap-1 items-end h-6">
                    <span className="w-1.5 h-3 bg-primary/20 rounded-full animate-pulse" />
                    <span className="w-1.5 h-6 bg-primary/40 rounded-full animate-pulse delay-75" />
                    <span className="w-1.5 h-4 bg-primary/20 rounded-full animate-pulse delay-150" />
                </div>
                <span className="font-medium text-sm tracking-wide uppercase">Connecting Peer...</span>
            </div>
        );
    }

    if (!stream && isLocal) {
        return (
            <div className="bg-white rounded-3xl shadow-xl border border-midnight/5 aspect-video flex flex-col items-center justify-center text-on-surface-variant gap-2 min-h-[200px] w-full">
                <Video className="w-8 h-8 text-midnight/20" />
                <span className="font-medium text-sm">Media Hardware Offline</span>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-3xl overflow-hidden relative shadow-2xl border border-midnight/5 aspect-video w-full group">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
            />
            <div className="absolute bottom-4 left-4 right-4 p-4 bg-white/90 backdrop-blur-md rounded-xl border border-white/20 flex items-center justify-between shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                        <span className="text-white font-bold text-lg">{label[0]}</span>
                    </div>
                    <div>
                        <div className="text-sm font-bold text-midnight">{label}</div>
                        <div className="text-xs font-semibold text-primary">Uncompressed Feed Active</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Recording state machine ──────────────────────────────────────────────────
//
//  idle → starting → recording → stopping → uploading → done
//                                         ↘ aborted (on hang-up mid-record)
//
type RecordingStatus =
    | 'idle'
    | 'starting'    // awaiting multipart/start response
    | 'recording'   // MediaRecorder running, parts streaming to R2
    | 'stopping'    // onstop fired, final part + multipart/complete in flight
    | 'uploading'   // (alias for stopping — used for UI label only)
    | 'done'        // upload committed, download URL available
    | 'aborted';    // user hung up mid-recording or an error occurred

// ─── VideoCall ────────────────────────────────────────────────────────────────

export const VideoCall: React.FC = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();
    const [hasStarted, setHasStarted] = useState(false);

    useEffect(() => {
        if (!roomId) navigate('/room', { replace: true });
    }, [roomId, navigate]);

    const activeRoomId = roomId || 'default-room';
    const { user, token } = useAuth();

    const { localStream, recordingStream, remoteStreams, initialize, endCall } = useWebRTC(
        SIGNALING_URL,
        activeRoomId,
        token,
        user
    );

    // ── Recording state ────────────────────────────────────────────────────────
    const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
    const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [recordingError, setRecordingError] = useState<string | null>(null);

    // Stable refs so event handlers in startRecording() close over them correctly
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const uploaderRef = useRef<MultipartUploader | null>(null);
    const recordingStartTimeRef = useRef<number>(0);

    // ── Start recording ────────────────────────────────────────────────────────
    const startRecording = useCallback(async () => {
        if (!recordingStream) return;

        setRecordingStatus('starting');
        setUploadProgress(null);
        setDownloadUrl(null);
        setRecordingError(null);

        // 2. Resolve codec — prefer VP9 for better compression at 4K
        const videoBitsPerSecond = 8_000_000;
        const mimeTypes = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
        ];
        const mimeType = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
        const recorderOptions: MediaRecorderOptions = { mimeType, videoBitsPerSecond };

        // 1. Initialise the uploader and open the multipart session on R2
        const uploader = new MultipartUploader({
            roomId: activeRoomId,
            onProgress: (progress) => setUploadProgress(progress),
            onComplete: (url) => {
                setDownloadUrl(url);
                setRecordingStatus('done');
            },
            onError: (err) => {
                console.error('[Recording] Upload error:', err);
                setRecordingError(err.message);
                setRecordingStatus('aborted');
            },
        });
        uploaderRef.current = uploader;

        try {
            await uploader.start(mimeType);
        } catch (err: any) {
            setRecordingError('Could not start upload session. Check your connection.');
            setRecordingStatus('idle');
            return;
        }

        // 3. Start MediaRecorder with 5-second timeslice.
        //    At 8 Mbps → ~5 MB per chunk, which satisfies R2's 5 MB minimum part size.
        try {
            const recorder = new MediaRecorder(recordingStream, recorderOptions);

            recorder.ondataavailable = (event) => {
                if (event.data?.size > 0) {
                    uploader.addChunk(event.data);
                }
            };

            recorder.onstop = async () => {
                const durationSeconds = Math.round((Date.now() - recordingStartTimeRef.current) / 1000);
                setRecordingStatus('uploading');
                await uploader.finalise(durationSeconds);
            };

            recorder.onerror = (event) => {
                console.error('[Recording] MediaRecorder error:', event);
                setRecordingError('MediaRecorder encountered an error.');
                setRecordingStatus('aborted');
                uploader.abort();
            };

            mediaRecorderRef.current = recorder;
            recordingStartTimeRef.current = Date.now();
            recorder.start(5_000); // emit a chunk every 5 seconds
            setRecordingStatus('recording');
        } catch (err: any) {
            console.error('[Recording] Failed to create MediaRecorder:', err);
            setRecordingError('Could not start recording. Codec not supported?');
            setRecordingStatus('idle');
            uploader.abort();
        }
    }, [recordingStream, activeRoomId]);

    // ── Stop recording ─────────────────────────────────────────────────────────
    const stopRecording = useCallback(() => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            // onstop handler will call uploader.finalise()
            recorder.stop();
        }
    }, []);

    // ── Hang up ────────────────────────────────────────────────────────────────
    const handleHangUp = useCallback(() => {
        // If recording is active, stop the recorder gracefully but abort the upload
        // (the user explicitly left — don't silently finish a long upload in the BG)
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
            recorder.stop();
        }
        uploaderRef.current?.abort();
        setRecordingStatus('aborted');

        endCall();
        setHasStarted(false);
    }, [endCall]);

    // ── Local fallback download ────────────────────────────────────────────────
    // If the upload succeeds the user gets the cloud URL.
    // If it fails / they abort, this is not available since we no longer buffer
    // in RAM — it's a deliberate tradeoff. If offline-first support matters,
    // keep the legacy blob approach as a parallel path.

    // ── Misc UI ────────────────────────────────────────────────────────────────
    const handleStart = async () => {
        try {
            await initialize();
            setHasStarted(true);
        } catch (err: any) {
            console.error('Failed to initialize WebRTC', err);
            alert(
                `Hardware Access Denied: ${err.message}\n\nNote: Mobile browsers require HTTPS to access cameras/microphones.`
            );
        }
    };

    const streamsMap = Object.entries(remoteStreams);
    const inviteLink = `${window.location.origin}/room/${activeRoomId}`;
    const [linkCopied, setLinkCopied] = useState(false);

    const copyInviteLink = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
        } catch {
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

    // ── Derived UI flags ───────────────────────────────────────────────────────
    const isRecording = recordingStatus === 'recording';
    const isFinishing = recordingStatus === 'stopping' || recordingStatus === 'uploading';
    const isDone = recordingStatus === 'done';
    const isIdle = recordingStatus === 'idle' || recordingStatus === 'aborted';

    // Progress label shown on the control bar while parts stream up
    const progressLabel = uploadProgress
        ? `${uploadProgress.partsUploaded} / ${uploadProgress.partsTotal} parts · ${Math.round(uploadProgress.bytesUploaded / 1_048_576)} MB`
        : 'Finalising…';

    return (
        <div className="min-h-screen bg-surface">
            {/* Header */}
            <header className="fixed top-0 w-full z-40 bg-white/80 backdrop-blur-xl border-b border-midnight/5 shadow-sm">
                <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/')}>
                        <span className="text-xl font-bold tracking-tight text-midnight font-headline">
                            ArchitectSaaS
                        </span>
                        <span className="px-3 py-1 bg-red-500/10 text-red-600 rounded-full text-xs uppercase tracking-widest font-bold">
                            Live Studio
                        </span>
                    </div>

                    <button
                        onClick={copyInviteLink}
                        title="Click to copy invite link"
                        className={`flex items-center gap-2 text-xs font-bold px-3.5 py-2 rounded-xl border transition-all select-none ${linkCopied
                                ? 'bg-primary/10 border-primary/30 text-primary'
                                : 'bg-surface-low border-midnight/8 text-midnight hover:border-primary/25 hover:text-primary hover:bg-primary/5'
                            }`}
                    >
                        {linkCopied ? (
                            <>
                                <Check className="w-3.5 h-3.5 shrink-0" />
                                <span>Copied!</span>
                            </>
                        ) : (
                            <>
                                <Link2 className="w-3.5 h-3.5 shrink-0" />
                                <span className="font-mono max-w-[180px] sm:max-w-[260px] truncate">
                                    {inviteLink}
                                </span>
                            </>
                        )}
                    </button>
                </div>
            </header>

            <main className="flex flex-col items-center pt-28 px-6 font-sans pb-32">
                <div className="w-full max-w-7xl relative">

                    {/* Recording indicator */}
                    {isRecording && (
                        <div className="absolute -top-12 right-0 z-10 flex items-center gap-3 bg-red-500 rounded-full px-4 py-1.5 shadow-lg shadow-red-500/30">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <span className="text-xs font-bold tracking-widest text-white uppercase">
                                Recording · Streaming to Cloud
                            </span>
                            {uploadProgress && (
                                <span className="text-xs text-white/80 font-mono">
                                    {Math.round(uploadProgress.bytesUploaded / 1_048_576)} MB uploaded
                                </span>
                            )}
                        </div>
                    )}

                    {/* Upload finishing indicator */}
                    {isFinishing && (
                        <div className="absolute -top-12 right-0 z-10 flex items-center gap-3 bg-primary rounded-full px-4 py-1.5 shadow-lg shadow-primary/30 animate-pulse">
                            <div className="w-2 h-2 rounded-full bg-white" />
                            <span className="text-xs font-bold tracking-widest text-white uppercase">
                                {progressLabel}
                            </span>
                        </div>
                    )}

                    {/* Error banner */}
                    {recordingError && (
                        <div className="absolute -top-12 right-0 z-10 flex items-center gap-2 bg-red-100 border border-red-200 text-red-700 rounded-full px-4 py-1.5">
                            <span className="text-xs font-bold">⚠ {recordingError}</span>
                        </div>
                    )}

                    {/* Video grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-max relative z-0">
                        <VideoPlayer stream={localStream} isLocal label="You (Local Host)" />

                        {hasStarted && streamsMap.length === 0 && (
                            <VideoPlayer stream={null} label="Waiting..." />
                        )}

                        {streamsMap.map(([peerId, stream]) => (
                            <VideoPlayer
                                key={peerId}
                                stream={stream}
                                label={`Peer: ${peerId.substring(0, 5)}`}
                            />
                        ))}
                    </div>
                </div>

                {/* Control bar */}
                <div className="flex flex-wrap items-center justify-center gap-4 fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-xl p-3 pr-4 rounded-2xl border border-midnight/10 shadow-2xl shadow-primary/10 z-50">
                    {!hasStarted ? (
                        <button
                            onClick={handleStart}
                            className="emerald-gradient text-white font-bold px-10 py-4 rounded-xl text-md flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                        >
                            Start Hardware & Enter Call
                        </button>
                    ) : (
                        <>
                            {/* Hang up */}
                            <button
                                onClick={handleHangUp}
                                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold px-8 py-4 rounded-xl text-md flex items-center justify-center active:scale-95 transition-all"
                            >
                                Leave Call
                            </button>

                            {recordingStream && <div className="h-8 w-px bg-midnight/10 mx-2" />}

                            {/* Start recording — only shown when idle */}
                            {recordingStream && isIdle && (
                                <button
                                    onClick={startRecording}
                                    className="bg-white border border-midnight/10 text-midnight font-bold px-6 py-4 rounded-xl text-md flex items-center justify-center gap-2 hover:bg-surface-low transition-all"
                                >
                                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse border border-white/50" />
                                    Record & Stream
                                </button>
                            )}

                            {/* Stop recording */}
                            {isRecording && (
                                <button
                                    onClick={stopRecording}
                                    className="bg-red-600 text-white font-bold px-6 py-4 rounded-xl text-md flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 hover:bg-red-700 transition-all"
                                >
                                    <div className="w-3 h-3 rounded-sm bg-white" />
                                    Stop Recording
                                </button>
                            )}

                            {/* In-flight status pill */}
                            {isFinishing && (
                                <div className="bg-primary/10 border border-primary/20 text-primary font-bold px-6 py-4 rounded-xl text-md flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                    {progressLabel}
                                </div>
                            )}

                            {/* Done — open in recordings library */}
                            {isDone && downloadUrl && (
                                <>
                                    <div className="h-8 w-px bg-midnight/10 mx-2" />
                                    <a
                                        href={downloadUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="emerald-gradient text-white font-bold px-6 py-4 rounded-xl text-md flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                                        onClick={() => {
                                            // Reset so the user can record again
                                            setTimeout(() => {
                                                setDownloadUrl(null);
                                                setRecordingStatus('idle');
                                                setUploadProgress(null);
                                            }, 500);
                                        }}
                                    >
                                        <Check className="w-4 h-4" />
                                        View Recording ↗
                                    </a>
                                </>
                            )}
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default VideoCall;
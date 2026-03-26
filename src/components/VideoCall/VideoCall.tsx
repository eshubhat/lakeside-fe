import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import { Copy, Video } from 'lucide-react';
import { memoryToken } from '../../services/api';

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL || 'ws://localhost:3001';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Helper component to render individual videos cleanly in the ArchitectSaaS style
const VideoPlayer: React.FC<{ stream: MediaStream | null; isLocal?: boolean; label: string }> = ({
  stream,
  isLocal,
  label
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

export const VideoCall: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [hasStarted, setHasStarted] = useState(false);

  // If loaded without parameter directly locally fallback to the staging menu natively
  useEffect(() => {
    if (!roomId) {
      navigate('/room', { replace: true });
    }
  }, [roomId, navigate]);

  const activeRoomId = roomId || 'default-room';
  const { user, token } = useAuth();

  // Hook handles connection for a particular room dynamically securely passing credentials bounded into JWT verification
  const {
    localStream,       // 720p preview — used for VideoPlayer tile display
    recordingStream,   // 4K full quality — used for MediaRecorder only
    remoteStreams,
    initialize,
    endCall,
  } = useWebRTC(SIGNALING_URL, activeRoomId, token, user);

  // --- Recording Logic ---
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const startRecording = useCallback(() => {
    if (!recordingStream) return;

    setRecordedBlob(null);
    recordedChunksRef.current = [];

    // Target ~8 Mbps for high quality 4K/1080p recording
    const videoBitsPerSecond = 8000000;
    let options: any = { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond };

    // Fallbacks for codec support
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm', videoBitsPerSecond };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { videoBitsPerSecond }; // fallback to default codec but retain bitrate
        }
      }
    }

    try {
      const recorder = new MediaRecorder(recordingStream, options);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: options.mimeType || 'video/webm'
        });
        setRecordedBlob(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100); // Emit data roughly every 100ms
      setIsRecording(true);
    } catch (e) {
      console.error('Exception while creating MediaRecorder:', e);
    }
  }, [recordingStream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  // Handlers for exporting Blob memory output natively
  const handleDownload = () => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = `recording-${Date.now()}.webm`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleUpload = () => {
    if (!recordedBlob) return;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);

    const formData = new FormData();
    formData.append('video', recordedBlob, `recording-${Date.now()}.webm`);

    const xhr = new XMLHttpRequest();
    // Connects exactly to the NodeJS REST endpoint conditionally mapped via Vite ENV variables
    xhr.open('POST', `${API_URL}/upload`, true);
    xhr.setRequestHeader('Authorization', `Bearer ${memoryToken}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setIsUploading(false);
      if (xhr.status === 200 || xhr.status === 201) {
        setUploadSuccess(true);
        setTimeout(() => {
          setRecordedBlob(null);
          setUploadSuccess(false);
        }, 4000);
      } else {
        alert('Failed to securely upload video payload to database.');
      }
    };

    xhr.onerror = () => {
      setIsUploading(false);
      alert('Network transmission failed! Check connectivity to the upload node.');
    };

    xhr.send(formData);
  };

  const handleStart = async () => {
    try {
      await initialize();
      setHasStarted(true);
    } catch (err: any) {
      console.error('Failed to initialize WebRTC', err);
      alert(
        `Hardware Access Denied: ${err.message}\n\nNote: Mobile browsers strictly REQUIRE a secure HTTPS connection to access cameras/microphones over a local network. If you are using an IP address (like 192.168.x.x), it will silently block hardware access.`
      );
    }
  };

  const handleHangUp = () => {
    // If recording, stop it automatically upon hang up
    if (isRecording) {
      stopRecording();
    }
    endCall();
    setHasStarted(false);
  };

  const streamsMap = Object.entries(remoteStreams);
  const inviteLink = `${window.location.origin}/room/${activeRoomId}`;

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    alert('Invite link securely copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header matching Landing */}
      <header className="fixed top-0 w-full z-40 bg-white/80 backdrop-blur-xl border-b border-midnight/5 shadow-sm">
        <div className="flex justify-between items-center w-full px-6 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/')}>
            <span className="text-xl font-bold tracking-tight text-midnight font-headline">ArchitectSaaS</span>
            <span className="px-3 py-1 bg-red-500/10 text-red-600 rounded-full text-xs uppercase tracking-widest font-bold">Live Studio</span>
          </div>

          {hasStarted && (
            <div className="flex items-center gap-4 bg-surface-low rounded-xl px-1.5 py-1.5 border border-midnight/5">
              <span className="text-sm font-bold text-midnight pl-3">Room: <span className="text-primary font-mono ml-1 tracking-wider">{activeRoomId}</span></span>
              <button
                onClick={copyInviteLink}
                className="flex items-center gap-2 text-xs font-bold text-midnight bg-white shadow-sm border border-midnight/5 hover:border-primary/30 hover:text-primary px-3 py-1.5 rounded-lg transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Link
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex flex-col items-center pt-28 px-6 font-sans pb-32">
        <div className="w-full max-w-7xl relative">

          {/* Recording active indicator */}
          {isRecording && (
            <div className="absolute -top-12 right-0 z-10 flex items-center justify-center bg-red-500 rounded-full px-4 py-1.5 shadow-lg shadow-red-500/30 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-white mr-2" />
              <span className="text-xs font-bold tracking-widest text-white uppercase">Recording 4K Local</span>
            </div>
          )}

          {/* We use CSS grid to automatically wrap and size the video elements */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-max relative z-0">

            {/* Always display local video first */}
            <VideoPlayer
              stream={localStream}
              isLocal
              label="You (Local Host)"
            />

            {/* Render skeleton card if no one else has joined yet */}
            {hasStarted && streamsMap.length === 0 && (
              <VideoPlayer stream={null} label="Waiting..." />
            )}

            {/* Render an individual Video item for each participant */}
            {streamsMap.map(([peerId, stream]) => (
              <VideoPlayer
                key={peerId}
                stream={stream}
                label={`Peer: ${peerId.substring(0, 5)}`}
              />
            ))}

          </div>
        </div>

        {/* Primary Action bar - Anchored to bottom similar to modern video calling UX */}
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
              <button
                onClick={handleHangUp}
                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold px-8 py-4 rounded-xl text-md flex items-center justify-center active:scale-95 transition-all"
              >
                Leave Call
              </button>

              {/* Recording Controls Divider */}
              {recordingStream && (
                <div className="h-8 w-px bg-midnight/10 mx-2" />
              )}

              {recordingStream && !isRecording && (
                <button
                  onClick={startRecording}
                  className="bg-white border border-midnight/10 text-midnight font-bold px-6 py-4 rounded-xl text-md flex items-center justify-center gap-2 hover:bg-surface-low transition-all"
                >
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse border border-white/50" />
                  Record Locally
                </button>
              )}

              {localStream && isRecording && (
                <button
                  onClick={stopRecording}
                  className="bg-red-600 text-white font-bold px-6 py-4 rounded-xl text-md flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 hover:bg-red-700 transition-all"
                >
                  <div className="w-3 h-3 rounded-sm bg-white" />
                  Stop Recording
                </button>
              )}

              {/* Download/Upload Operations */}
              {recordedBlob && !isRecording && (
                <>
                  <div className="h-8 w-px bg-midnight/10 mx-2" />

                  <button
                    onClick={handleDownload}
                    disabled={isUploading}
                    className="bg-surface-low border border-midnight/10 hover:bg-white text-midnight font-bold px-6 py-4 rounded-xl text-md transition-all focus:outline-none disabled:opacity-50"
                  >
                    Download WebM
                  </button>

                  <button
                    onClick={handleUpload}
                    disabled={isUploading || uploadSuccess}
                    className={`flex items-center justify-center font-bold px-6 py-4 rounded-xl text-md shadow-lg shadow-primary/20 transition-all focus:outline-none relative overflow-hidden ${uploadSuccess ? 'bg-midnight text-primary' : 'emerald-gradient text-white hover:scale-105 active:scale-95'
                      } disabled:opacity-50`}
                  >
                    {/* Progress Bar Background */}
                    {isUploading && (
                      <div
                        className="absolute top-0 left-0 h-full bg-white/20 transition-all duration-300 pointer-events-none"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    )}
                    <span className="relative z-10 w-full text-center">
                      {uploadSuccess ? 'Uploaded! ✓' : isUploading ? `Uploading ${uploadProgress}%` : 'Upload Stream'}
                    </span>
                  </button>
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

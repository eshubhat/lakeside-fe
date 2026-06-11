import { useEffect, useRef, useState, useCallback } from 'react';

export interface SignalMessage {
  type: 'join' | 'user-joined' | 'user-left' | 'offer' | 'answer' | 'ice-candidate' | 'connected' | 'start-recording' | 'stop-recording';
  payload?: any;
}

/** STUN-only fallback — used until dynamic credentials are ready */
const STUN_FALLBACK: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];


const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export const useWebRTC = (
  signalingUrl: string,
  roomId: string,
  token: string | null,
  user: any,
  /** Dynamic ICE servers from useTurnCredentials — falls back to STUN-only if null */
  iceServers: RTCIceServer[] | null,
  /** Optional callback for custom application-level signals */
  onSignal?: (msg: SignalMessage) => void,
) => {
  // previewStream — low quality, sent over WebRTC to peers (shown in VideoPlayer tiles)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // recordingStream — full quality, used only by MediaRecorder in VideoCall.tsx, never sent over the network
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  const myIdRef = useRef<string | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  // Queue ICE candidates that arrive before remote description is set
  const iceCandidateQueues = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const ws = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);       // stable ref for preview stream cleanup
  const recordingStreamRef = useRef<MediaStream | null>(null);   // stable ref for recording stream cleanup
  // Ref so createPeerConnection always sees the latest ICE servers without needing them as a dep
  const iceServersRef = useRef<RTCIceServer[]>(iceServers ?? STUN_FALLBACK);
  useEffect(() => { iceServersRef.current = iceServers ?? STUN_FALLBACK; }, [iceServers]);

  const reconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 7;

  const startMedia = useCallback(async () => {
    try {
      if (isMobile) {
        // Mobile: open camera ONCE — two getUserMedia calls will NotReadableError
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { min: 640, ideal: 3840 },
            height: { min: 480, ideal: 2160 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        const settings = videoTrack.getSettings();
        console.log(`[WebRTC] Mobile camera opened: ${settings.width}x${settings.height}`);

        // Both streams share the same tracks — one camera handle
        // Quality difference is handled by RTCRtpSender maxBitrate cap, not capture resolution
        const highQualityStream = new MediaStream([videoTrack, audioTrack]);
        recordingStreamRef.current = highQualityStream;
        setRecordingStream(highQualityStream);

        const previewStream = new MediaStream([videoTrack, audioTrack]);
        localStreamRef.current = previewStream;
        setLocalStream(previewStream);

        return previewStream;

      } else {
        // Desktop: two separate getUserMedia calls are fine
        // High quality — local recording only, never transmitted over WebRTC
        const highQualityStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 3840 }, height: { ideal: 2160 } },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        const settings = highQualityStream.getVideoTracks()[0].getSettings();
        console.log(`[WebRTC] Desktop recording stream: ${settings.width}x${settings.height}`);
        recordingStreamRef.current = highQualityStream;
        setRecordingStream(highQualityStream);

        // Low quality — transmitted to peers via WebRTC only
        const previewStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        localStreamRef.current = previewStream;
        setLocalStream(previewStream);

        return previewStream;
      }

    } catch (error) {
      console.error('[WebRTC] Error accessing media devices.', error);
      throw error;
    }
  }, []);

  /** Drain any queued ICE candidates for a peer after remote description is set. */
  const drainIceCandidates = useCallback(async (peerId: string, pc: RTCPeerConnection) => {
    const queued = iceCandidateQueues.current.get(peerId) ?? [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (e) {
        console.error(`[WebRTC] Failed to add queued ICE candidate for ${peerId}:`, e);
      }
    }
    iceCandidateQueues.current.delete(peerId);
  }, []);

  const removePeerConnection = useCallback((peerId: string) => {
    const pc = peerConnections.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(peerId);
    }
    iceCandidateQueues.current.delete(peerId);
    setRemoteStreams((prev) => {
      const updated = { ...prev };
      delete updated[peerId];
      return updated;
    });
  }, []);

  const createPeerConnection = useCallback((peerId: string, stream: MediaStream) => {
    // Read latest ICE servers from ref — avoids stale closure & prevents cascade hook invalidation
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE state ${peerId}: ${pc.iceConnectionState}`);
    };

    pc.onsignalingstatechange = () => {
      console.log(`[WebRTC] Signaling state ${peerId}: ${pc.signalingState}`);
    };

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      console.log(`[WebRTC] ontrack from ${peerId}: kind=${event.track.kind}`);
      setRemoteStreams((prev) => {
        // Build on existing tracks for this peer (audio + video arrive in separate events)
        const existing = prev[peerId];
        const merged = new MediaStream(existing ? existing.getTracks() : []);
        // Replace any existing track of the same kind, or add if not present
        merged.getTracks()
          .filter(t => t.kind === event.track.kind)
          .forEach(t => merged.removeTrack(t));
        merged.addTrack(event.track);
        return { ...prev, [peerId]: merged };
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'ice-candidate',
          payload: { targetId: peerId, senderId: myIdRef.current, candidate: event.candidate },
        }));
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Peer ${peerId} connection state: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        // Cap video encoding to 1.5 Mbps — keeps TURN relay bandwidth low for preview stream
        const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (videoSender) {
          const params = videoSender.getParameters();
          if (params.encodings?.length) {
            params.encodings[0].maxBitrate = 1_500_000;
          } else {
            params.encodings = [{ maxBitrate: 1_500_000 }];
          }
          videoSender.setParameters(params).catch(e =>
            console.warn('[WebRTC] Could not set encoding params:', e)
          );
        }
      }
      if (pc.connectionState === 'failed') {
        console.warn(`[WebRTC] Peer ${peerId} connection failed — removing.`);
        removePeerConnection(peerId);
      }
    };

    peerConnections.current.set(peerId, pc);
    return pc;
  }, [removePeerConnection]);

  const connectWs = useCallback((activeStream: MediaStream) => {
    if (ws.current) {
      ws.current.onclose = null;
      ws.current.close();
      ws.current = null;
    }

    const url = token ? `${signalingUrl}?token=${token}` : signalingUrl;
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      console.log('[WebRTC] WebSocket connected');
      reconnectAttemptRef.current = 0;

      // Clear stale peer connections before re-announcing presence in the room
      peerConnections.current.forEach((pc) => pc.close());
      peerConnections.current.clear();
      iceCandidateQueues.current.clear();
      setRemoteStreams({});

      ws.current?.send(JSON.stringify({ type: 'join', payload: { roomId, user } }));
    };

    ws.current.onclose = () => {
      ws.current = null;
      if (reconnectAttemptRef.current < maxReconnectAttempts) {
        const timeoutMs = Math.pow(2, reconnectAttemptRef.current) * 1000;
        console.warn(`[WebRTC] Disconnected. Reconnecting in ${timeoutMs}ms...`);
        setTimeout(() => {
          reconnectAttemptRef.current++;
          connectWs(activeStream);
        }, timeoutMs);
      } else {
        console.error('[WebRTC] Exhausted reconnection attempts.');
      }
    };

    ws.current.onerror = (err) => {
      console.error('[WebRTC] WebSocket error:', err);
    };

    ws.current.onmessage = async (event) => {
      try {
        const message: SignalMessage = JSON.parse(event.data);
        const { type, payload } = message;

        switch (type) {
          case 'connected':
            myIdRef.current = payload.userId;
            break;

          case 'user-joined': {
            const peerId = payload.userId;
            if (peerId === myIdRef.current) break;

            const pc = createPeerConnection(peerId, activeStream);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            // Drain any ICE candidates that arrived before the offer was created
            await drainIceCandidates(peerId, pc);
            ws.current?.send(JSON.stringify({
              type: 'offer',
              payload: { targetId: peerId, senderId: myIdRef.current, sdp: pc.localDescription },
            }));
            break;
          }

          case 'offer': {
            const { targetId, senderId, sdp } = payload;
            if (targetId && targetId !== myIdRef.current) break;

            let pc = peerConnections.current.get(senderId);
            if (!pc) pc = createPeerConnection(senderId, activeStream);

            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            // CRITICAL: drain queued ICE candidates now that remote description is set
            await drainIceCandidates(senderId, pc);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.current?.send(JSON.stringify({
              type: 'answer',
              payload: { targetId: senderId, senderId: myIdRef.current, sdp: pc.localDescription },
            }));
            break;
          }

          case 'answer': {
            const { targetId, senderId, sdp } = payload;
            if (targetId && targetId !== myIdRef.current) break;

            const pc = peerConnections.current.get(senderId);
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(sdp));
              // Drain any ICE candidates that arrived before the answer
              await drainIceCandidates(senderId, pc);
            }
            break;
          }

          case 'ice-candidate': {
            const { targetId, senderId, candidate } = payload;
            if (targetId && targetId !== myIdRef.current) break;

            const pc = peerConnections.current.get(senderId);
            if (!candidate) break;

            const iceCandidate = new RTCIceCandidate(candidate);

            if (pc?.remoteDescription) {
              // Remote description is ready — apply immediately
              try {
                await pc.addIceCandidate(iceCandidate);
              } catch (e) {
                console.error(`[WebRTC] addIceCandidate failed for ${senderId}:`, e);
              }
            } else {
              // Queue until after setRemoteDescription
              if (!iceCandidateQueues.current.has(senderId)) {
                iceCandidateQueues.current.set(senderId, []);
              }
              iceCandidateQueues.current.get(senderId)!.push(iceCandidate);
            }
            break;
          }

          case 'user-left':
            removePeerConnection(payload.userId);
            break;

          default:
            if (onSignal) onSignal(message);
            else console.log('[WebRTC] Unhandled message type:', type);
        }
      } catch (error) {
        console.error('[WebRTC] Error handling signaling message:', error);
      }
    };
  }, [signalingUrl, roomId, token, user, createPeerConnection, removePeerConnection, drainIceCandidates, onSignal]);

  const broadcastSignal = useCallback((type: SignalMessage['type'], payload?: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type,
        payload: { ...payload, senderId: myIdRef.current, roomId }
      }));
    }
  }, [roomId]);

  const initialize = useCallback(async () => {
    // Guard against already-open connections
    if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

    const stream = await startMedia();
    connectWs(stream);
  }, [connectWs, startMedia]);

  const endCall = useCallback(() => {
    reconnectAttemptRef.current = maxReconnectAttempts;

    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    iceCandidateQueues.current.clear();

    if (ws.current) {
      ws.current.onclose = null;
      ws.current.close();
      ws.current = null;
    }

    // Stop screen share tracks and compositor if active
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    setIsScreenSharing(false);

    if (compositorRef.current) {
      compositorRef.current.stop();
      compositorRef.current.canvasTrack.stop();
      compositorRef.current.originalCameraTrack.stop();
      compositorRef.current.originalHQCameraTrack?.stop();
      compositorRef.current = null;
    }

    // Stop preview tracks
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (isMobile) {
      // Tracks are shared — already stopped above, just clear the ref
      recordingStreamRef.current = null;
    } else {
      // Desktop has separate tracks — stop them independently
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
    }

    setLocalStream(null);
    setRecordingStream(null);
    setRemoteStreams({});
    myIdRef.current = null;
  }, []); // No dependencies — uses refs throughout

  const changeDevice = useCallback(async (deviceId: string, kind: 'audioinput' | 'videoinput') => {
    try {
      const isVideo = kind === 'videoinput';
      const constraints = {
        [isVideo ? 'video' : 'audio']: isVideo 
          ? { deviceId: { exact: deviceId } } 
          : { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = isVideo ? newStream.getVideoTracks()[0] : newStream.getAudioTracks()[0];

      if (!newTrack) return;

      if (localStreamRef.current) {
        const oldTracks = isVideo
          ? localStreamRef.current.getVideoTracks()
          : localStreamRef.current.getAudioTracks();
        oldTracks.forEach(t => { localStreamRef.current!.removeTrack(t); t.stop(); });
        localStreamRef.current.addTrack(newTrack);
      }

      // CRITICAL: we mutate the same MediaStream object that MediaRecorder is
      // already recording. removeTrack + addTrack on a live stream is the only
      // safe way to inject a new track without stopping the recorder.
      const recStream = recordingStreamRef.current;
      if (recStream) {
        if (recStream === localStreamRef.current) {
          // Mobile path: streams are shared — track already updated above.
        } else {
          // Desktop path: separate high-quality recording stream.
          const oldTracks = isVideo ? recStream.getVideoTracks() : recStream.getAudioTracks();
          oldTracks.forEach(t => { recStream.removeTrack(t); t.stop(); });
          // addTrack on the live stream — MediaRecorder sees the new track on
          // the next timeslice without any stop/start needed.
          recStream.addTrack(newTrack.clone());
        }
      }

      // replaceTrack is non-destructive: no renegotiation needed, no interruption.
      peerConnections.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === (isVideo ? 'video' : 'audio'));
        if (sender) {
          sender.replaceTrack(newTrack).catch(err => console.error('[WebRTC] replaceTrack error:', err));
        }
      });

      if (localStreamRef.current) {
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }
    } catch (err) {
      console.error('[WebRTC] Error changing device:', err);
    }
  }, []);

  const endCallRef = useRef(endCall);
  useEffect(() => { endCallRef.current = endCall; }, [endCall]);

  useEffect(() => {
    return () => { endCallRef.current(); };
  }, []); // Only runs on true component unmount

  const toggleAudio = useCallback(async (enabled: boolean, deviceId?: string) => {
    if (!enabled) {
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; t.stop(); localStreamRef.current?.removeTrack(t); });
      recordingStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; t.stop(); recordingStreamRef.current?.removeTrack(t); });
      if (localStreamRef.current) setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    } else if (deviceId) {
      await changeDevice(deviceId, 'audioinput');
    }
  }, [changeDevice]);

  const toggleVideo = useCallback(async (enabled: boolean, deviceId?: string) => {
    if (!enabled) {
      localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = false; t.stop(); localStreamRef.current?.removeTrack(t); });
      recordingStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = false; t.stop(); recordingStreamRef.current?.removeTrack(t); });
      if (localStreamRef.current) setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    } else if (deviceId) {
      await changeDevice(deviceId, 'videoinput');
    }
  }, [changeDevice]);

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);

  /**
   * compositorRef holds everything needed to cleanly tear down the canvas compositor:
   * - stop(): cancels the setInterval draw loop and nulls video elements
   * - canvasTrack: the MediaStreamTrack produced by canvas.captureStream()
   * - originalCameraTrack: the camera track that was active before screen share started
   *   (kept alive — used by the compositor's offscreen camera video element)
   */
  const compositorRef = useRef<{
    stop: () => void;
    canvasTrack: MediaStreamTrack;
    originalCameraTrack: MediaStreamTrack;
    originalHQCameraTrack?: MediaStreamTrack;
  } | null>(null);

  const shareScreen = useCallback(async () => {
    // ── STOP SCREEN SHARE ───────────────────────────────────────────────────
    if (isScreenSharing) {
      const compositor = compositorRef.current;
      compositor?.stop();
      compositor?.canvasTrack.stop();
      compositorRef.current = null;
      screenTrackRef.current?.stop();
      screenTrackRef.current = null;
      setIsScreenSharing(false);

      const origCamTrack = compositor?.originalCameraTrack;
      if (!origCamTrack) return;

      // Restore camera in local preview stream
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(t => localStreamRef.current!.removeTrack(t));
        localStreamRef.current.addTrack(origCamTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      // Restore camera in recording stream — new object so VideoCall's useEffect fires
      const recStream = recordingStreamRef.current;
      const origHQCamTrack = compositor?.originalHQCameraTrack;
      if (recStream && recStream !== localStreamRef.current && origHQCamTrack) {
        const audio = recStream.getAudioTracks();
        const newRec = new MediaStream([origHQCamTrack.clone(), ...audio]);
        recordingStreamRef.current = newRec;
        setRecordingStream(newRec);
      }

      // Restore camera in peer connections
      peerConnections.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(origCamTrack).catch(e =>
          console.error('[WebRTC] replaceTrack (restore cam):', e)
        );
      });
      return;
    }

    // ── START SCREEN SHARE ──────────────────────────────────────────────────
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      });
      const screenTrack = displayStream.getVideoTracks()[0];
      screenTrackRef.current = screenTrack;

      const origCamTrack = localStreamRef.current?.getVideoTracks()[0];
      if (!origCamTrack) {
        console.error('[WebRTC] No camera track available — cannot start compositor');
        screenTrack.stop();
        return;
      }

      // ── Canvas compositor ─────────────────────────────────────────────────
      // Composites: full-frame screen share + mirrored PiP camera (bottom-right).
      // 1280×720 keeps CPU pressure manageable; rAF never piles up if a draw is slow.
      const COMP_W = 1280;
      const COMP_H = 720;
      const FPS    = 30;

      const canvas = document.createElement('canvas');
      canvas.width  = COMP_W;
      canvas.height = COMP_H;
      const ctx = canvas.getContext('2d', { alpha: false })!; // alpha:false → ~15% faster compositing

      // Offscreen video elements that feed the compositor — never inserted into the DOM
      const screenVid = document.createElement('video');
      screenVid.srcObject = new MediaStream([screenTrack]);
      screenVid.muted = true;
      screenVid.play().catch(() => {});

      const camVid = document.createElement('video');
      camVid.srcObject = new MediaStream([origCamTrack]);
      camVid.muted = true;
      camVid.play().catch(() => {});

      const PIP_W  = Math.round(COMP_W * 0.22);  // ~282px
      const PIP_H  = Math.round(COMP_H * 0.22);  // ~158px
      const PIP_X  = COMP_W - PIP_W - 20;
      const PIP_Y  = COMP_H - PIP_H - 20;

      // requestAnimationFrame: browser-managed, never stacks up if a frame is slow.
      // Much lower CPU pressure than setInterval at the same target FPS.
      let animFrameId = 0;
      const draw = () => {
        // Screen background
        if (screenVid.readyState >= 2) {
          ctx.drawImage(screenVid, 0, 0, COMP_W, COMP_H);
        } else {
          ctx.fillStyle = '#111216';
          ctx.fillRect(0, 0, COMP_W, COMP_H);
        }

        // PiP: mirrored camera overlay
        if (camVid.readyState >= 2) {
          ctx.save();
          ctx.translate(PIP_X + PIP_W, PIP_Y);
          ctx.scale(-1, 1); // mirror
          ctx.drawImage(camVid, 0, 0, PIP_W, PIP_H);
          ctx.restore();

          // Lime accent border
          ctx.strokeStyle = '#C8F135';
          ctx.lineWidth = 3;
          ctx.strokeRect(PIP_X, PIP_Y, PIP_W, PIP_H);
        }

        animFrameId = requestAnimationFrame(draw);
      };
      animFrameId = requestAnimationFrame(draw);

      const canvasTrack = canvas.captureStream(FPS).getVideoTracks()[0];

      let origHQCamTrack: MediaStreamTrack | undefined = undefined;

      // Local preview tile: shows compositor (screen + PiP cam)
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(t => localStreamRef.current!.removeTrack(t));
        localStreamRef.current.addTrack(canvasTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      }

      // Recording stream: new MediaStream → triggers VideoCall's useEffect → reattachRecorder
      const recStream = recordingStreamRef.current;
      if (recStream && recStream !== localStreamRef.current) {
        origHQCamTrack = recStream.getVideoTracks()[0];
        const audio = recStream.getAudioTracks();
        const newRec = new MediaStream([canvasTrack.clone(), ...audio]);
        recordingStreamRef.current = newRec;
        setRecordingStream(newRec);
      }

      compositorRef.current = {
        stop: () => {
          cancelAnimationFrame(animFrameId);
          screenVid.srcObject = null;
          camVid.srcObject = null;
        },
        canvasTrack,
        originalCameraTrack: origCamTrack,
        originalHQCameraTrack: origHQCamTrack,
      };

      setIsScreenSharing(true);

      // Peer connections: all remotes see screen + PiP cam composite
      peerConnections.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(canvasTrack).catch(e =>
          console.error('[WebRTC] replaceTrack (compositor):', e)
        );
      });

      // ── Native "Stop sharing" button ──────────────────────────────────────
      screenTrack.onended = () => {
        const compositor = compositorRef.current;
        compositor?.stop();
        compositor?.canvasTrack.stop();
        compositorRef.current = null;
        screenTrackRef.current = null;
        setIsScreenSharing(false);

        const camTrack = compositor?.originalCameraTrack;
        if (!camTrack) return;

        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(t => localStreamRef.current!.removeTrack(t));
          localStreamRef.current.addTrack(camTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }

        const recStream = recordingStreamRef.current;
        const hqCamTrack = compositor?.originalHQCameraTrack;
        if (recStream && recStream !== localStreamRef.current && hqCamTrack) {
          const audio = recStream.getAudioTracks();
          const newRec = new MediaStream([hqCamTrack.clone(), ...audio]);
          recordingStreamRef.current = newRec;
          setRecordingStream(newRec);
        }

        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(camTrack).catch(e =>
            console.error('[WebRTC] replaceTrack (restore cam on ended):', e)
          );
        });
      };

    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') {
        console.error('[WebRTC] getDisplayMedia error:', err);
      }
    }
  }, [isScreenSharing]);

  return { localStream, recordingStream, remoteStreams, initialize, endCall, toggleAudio, toggleVideo, changeDevice, shareScreen, isScreenSharing, broadcastSignal };
};

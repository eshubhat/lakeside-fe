import { useEffect, useRef, useState, useCallback } from 'react';

export interface SignalMessage {
  type: 'join' | 'user-joined' | 'user-left' | 'offer' | 'answer' | 'ice-candidate' | 'connected';
  payload?: any;
}

const ICE_SERVERS: RTCIceServer[] = [
  // ✅ Google STUN (fast direct connection)
  { urls: 'stun:stun.l.google.com:19302' },

  // ✅ Metered TURN (fallback relay)
  ...(import.meta.env.VITE_TURN_URL
    ? [
      {
        urls: [
          import.meta.env.VITE_TURN_URL,              // udp
          import.meta.env.VITE_TURN_URL_TCP || '',    // tcp fallback
        ].filter(Boolean),
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_CREDENTIAL,
      },
    ]
    : []),
];

export const useWebRTC = (signalingUrl: string, roomId: string, token: string | null, user: any) => {
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

  const reconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 7;

  const startMedia = useCallback(async () => {
    try {
      // 1. HIGH QUALITY — local recording only, never transmitted over WebRTC
      // const highQualityStream = await navigator.mediaDevices.getUserMedia({
      //   video: { width: { ideal: 3840 }, height: { ideal: 2160 } },
      //   audio: true,
      // });

      // In startMedia, split the try/catch:
      let highQualityStream: MediaStream;
      try {
        highQualityStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { min: 640, ideal: 3840 }, height: { min: 480, ideal: 2160 } },
          audio: true,
        });
        console.log('[WebRTC] Recording stream OK');
      } catch (e) {
        console.error('[WebRTC] Recording stream failed:', e); // ← check this on mobile
        throw e;
      }

      const videoTrack = highQualityStream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log(`[WebRTC] Recording resolution: ${settings.width}x${settings.height}`);
      }

      recordingStreamRef.current = highQualityStream;
      setRecordingStream(highQualityStream);

      // 2. LOW QUALITY — transmitted to peers via WebRTC, shown in video tiles
      //    720p at 30fps is plenty for a live preview feed (Riverside uses similar)
      const previewStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: true,
      });

      // Cap the WebRTC video encoding to 1.5 Mbps so TURN bandwidth stays low
      // This is applied per-sender after peer connections are created (see createPeerConnection)
      console.log(`[WebRTC] Preview stream ready for transmission`);

      localStreamRef.current = previewStream;
      setLocalStream(previewStream);

      return previewStream; // Only the preview stream is passed into WebRTC peer connections
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

  const createPeerConnection = useCallback((peerId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote track from ${peerId}`);
      const inboundStream = event.streams?.[0] ?? (() => {
        const s = new MediaStream();
        s.addTrack(event.track);
        return s;
      })();
      setRemoteStreams((prev) => ({ ...prev, [peerId]: inboundStream }));
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — removePeerConnection defined below

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
            console.log('[WebRTC] Unhandled message type:', type);
        }
      } catch (error) {
        console.error('[WebRTC] Error handling signaling message:', error);
      }
    };
  }, [signalingUrl, roomId, token, user, createPeerConnection, removePeerConnection, drainIceCandidates]);

  const initialize = useCallback(async () => {
    // Guard against already-open connections
    if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

    const stream = await startMedia();
    connectWs(stream);
  }, [connectWs, startMedia]);

  const endCall = useCallback(() => {
    // Prevent any further reconnection attempts
    reconnectAttemptRef.current = maxReconnectAttempts;

    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    iceCandidateQueues.current.clear();

    if (ws.current) {
      ws.current.onclose = null;
      ws.current.close();
      ws.current = null;
    }

    // Use the stable ref so this function doesn't depend on the localStream state value
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    setLocalStream(null);
    setRemoteStreams({});
    myIdRef.current = null;
  }, []); // No dependencies — uses refs throughout

  // Use a stable ref so the cleanup effect never re-fires due to endCall identity changing
  const endCallRef = useRef(endCall);
  useEffect(() => { endCallRef.current = endCall; }, [endCall]);

  useEffect(() => {
    return () => { endCallRef.current(); };
  }, []); // Only runs on true component unmount

  return { localStream, recordingStream, remoteStreams, initialize, endCall };
};
import { useEffect, useRef, useState, useCallback } from 'react';

export interface SignalMessage {
  type: 'join' | 'user-joined' | 'user-left' | 'offer' | 'answer' | 'ice-candidate' | 'connected';
  payload?: any;
}

export const useWebRTC = (signalingUrl: string, roomId: string) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  
  const myIdRef = useRef<string | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const ws = useRef<WebSocket | null>(null);
  
  // Reconnect state bounds
  const reconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 7; // Times out fully after approx ~2+ minutes total wait time 

  const startMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 3840 },
          height: { ideal: 2160 }
        }, 
        audio: true 
      });
      
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        console.log(`[WebRTC] Actual video resolution captured: ${settings.width}x${settings.height}`);
      }
      
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('Error accessing media devices.', error);
      throw error;
    }
  }, []);

  const createPeerConnection = useCallback((peerId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { 
          urls: 'stun:stun.l.google.com:19302' 
        },
        {
          urls: 'turn:your-turn-server.com:3478',
          username: 'placeholder-username',
          credential: 'placeholder-password'
        }
      ],
    });

    // Add local media tracks
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Handle inbound streams
    pc.ontrack = (event) => {
      console.log(`Received remote track from ${peerId}`);
      if (event.streams && event.streams[0]) {
        setRemoteStreams((prev) => ({
          ...prev,
          [peerId]: event.streams[0],
        }));
      } else {
        const inboundStream = new MediaStream();
        inboundStream.addTrack(event.track);
        setRemoteStreams((prev) => ({
          ...prev,
          [peerId]: inboundStream,
        }));
      }
    };

    // Forward ICE Candidates targeted at `peerId`
    pc.onicecandidate = (event) => {
      if (event.candidate && ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'ice-candidate',
          payload: { 
            targetId: peerId, 
            senderId: myIdRef.current, 
            candidate: event.candidate 
          },
        }));
      }
    };

    peerConnections.current.set(peerId, pc);
    return pc;
  }, []);

  const removePeerConnection = useCallback((peerId: string) => {
    const pc = peerConnections.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(peerId);
    }
    setRemoteStreams((prev) => {
      const updated = { ...prev };
      delete updated[peerId];
      return updated;
    });
  }, []);

  const connectWs = useCallback((activeStream: MediaStream) => {
    // Standard cleanup if an untethered ghost connection already somehow exists
    if (ws.current) {
      ws.current.onclose = null; // Explicitly flush cyclic recursions
      ws.current.close();
      ws.current = null;
    }

    ws.current = new WebSocket(signalingUrl);

    ws.current.onopen = () => {
      console.log('WebSocket network tunnel successful');
      
      // Reset exponential backoff constraints back to 0 so the next fail acts quickly
      reconnectAttemptRef.current = 0; 
      
      // Promptly re-register to the active URL parameter room to preserve multi-party state
      ws.current?.send(JSON.stringify({ type: 'join', payload: { roomId } }));
    };

    ws.current.onclose = () => {
      ws.current = null;
      
      // Determine exponential wait timer resolving: 1000ms, 2000ms, 4000ms, 8000ms...
      if (reconnectAttemptRef.current < maxReconnectAttempts) {
        const timeoutMs = Math.pow(2, reconnectAttemptRef.current) * 1000;
        console.warn(`WebSocket signaling dropped by Remote Host. Attempting reconnection in ${timeoutMs}ms...`);
        
        setTimeout(() => {
          reconnectAttemptRef.current++;
          connectWs(activeStream);
        }, timeoutMs);

      } else {
        console.error('Fatal WebRTC Signaling Error: Exhausted maximum backend reconnection thresholds.');
      }
    };

    ws.current.onerror = (err) => {
      console.error('WebSocket Error encountered during streaming negotiations:', err);
    };

    ws.current.onmessage = async (event) => {
      try {
        const message: SignalMessage = JSON.parse(event.data);
        const { type, payload } = message;

        switch (type) {
          case 'connected':
            // Initial payload from server assigning us a socket ID
            myIdRef.current = payload.userId;
            break;
            
          case 'user-joined':
            {
              const peerId = payload.userId;
              if (peerId === myIdRef.current) break; // sanity check
              
              const pc = createPeerConnection(peerId, activeStream);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              ws.current?.send(JSON.stringify({
                type: 'offer',
                payload: { 
                  targetId: peerId, 
                  senderId: myIdRef.current, 
                  sdp: pc.localDescription 
                }
              }));
            }
            break;

          case 'offer':
            {
              const { targetId, senderId, sdp } = payload;
              // Ignore messages not structurally mapped for our exact user ID explicitly
              if (targetId && targetId !== myIdRef.current) break;
              
              let pc = peerConnections.current.get(senderId);
              if (!pc) {
                pc = createPeerConnection(senderId, activeStream);
              }
              await pc.setRemoteDescription(new RTCSessionDescription(sdp));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.current?.send(JSON.stringify({
                type: 'answer',
                payload: { 
                  targetId: senderId, 
                  senderId: myIdRef.current, 
                  sdp: pc.localDescription 
                }
              }));
            }
            break;

          case 'answer':
            {
              const { targetId, senderId, sdp } = payload;
              if (targetId && targetId !== myIdRef.current) break;

              const pc = peerConnections.current.get(senderId);
              if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
              }
            }
            break;

          case 'ice-candidate':
            {
              const { targetId, senderId, candidate } = payload;
              if (targetId && targetId !== myIdRef.current) break;

              const pc = peerConnections.current.get(senderId);
              if (pc && candidate) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              }
            }
            break;

          case 'user-left':
            removePeerConnection(payload.userId);
            break;
            
          default:
            console.log('Unhandled signaling message mapping:', type);
        }
      } catch (error) {
        console.error('Error handling signaling message', error);
      }
    };
  }, [signalingUrl, roomId, createPeerConnection, removePeerConnection]);

  const initialize = useCallback(async () => {
    if (ws.current) return;
    
    // 1. Get DOM media hardware natively
    const stream = await startMedia();

    // 2. Safely trigger WS initialization looping with retry capacities passing context active state
    connectWs(stream);
  }, [connectWs, startMedia]);

  const endCall = useCallback(() => {
    // Neutralize exponential cyclic limits
    reconnectAttemptRef.current = maxReconnectAttempts; 

    // Teardown all PCs
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    
    // Close WS ensuring recursion listeners are correctly flushed null memory
    if (ws.current) {
        ws.current.onclose = null; 
        ws.current.close();
        ws.current = null;
    }
    
    // Stop camera/mic hardware physical inputs
    localStream?.getTracks().forEach((track) => track.stop());
    setLocalStream(null);
    setRemoteStreams({});
    myIdRef.current = null;
  }, [localStream]);

  // Handle immediate Cleanup correctly if DOM physically unmounted
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    localStream,
    remoteStreams,
    initialize,
    endCall,
  };
};

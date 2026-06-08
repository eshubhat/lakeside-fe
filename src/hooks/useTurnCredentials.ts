import { useState, useEffect } from 'react';
import { api } from '../services/api';

/** Shape returned by GET /turn/credentials */
interface TurnCredentials {
  username: string;
  password: string;
  ttl: number;
  uris: string[];
}

/** STUN-only fallback — used when the TURN credentials fetch fails */
const STUN_FALLBACK: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
];

/**
 * Fetches short-lived TURN credentials from the backend and converts them
 * into an RTCIceServer[] ready for use in RTCPeerConnection.
 *
 * Falls back to Google STUN only if the request fails so WebRTC still works
 * on local / same-network calls even when TURN is unavailable.
 */
export const useTurnCredentials = () => {
  const [iceServers, setIceServers] = useState<RTCIceServer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCredentials = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data } = await api.get<TurnCredentials>('/turn/credentials');

        if (cancelled) return;

        const servers: RTCIceServer[] = [
          // Always include a STUN server for direct (non-relayed) path discovery
          { urls: 'stun:stun.l.google.com:19302' },
        ];

        if (data.uris?.length) {
          servers.push({
            urls: data.uris,
            username: data.username,
            credential: data.password,
          });
        }

        setIceServers(servers);
        console.log('[TURN] Credentials fetched successfully. TTL:', data.ttl, 's');
      } catch (err: any) {
        if (cancelled) return;

        const msg = err?.response?.data?.error ?? err?.message ?? 'Unknown error';
        console.warn('[TURN] Failed to fetch credentials, falling back to STUN only:', msg);
        setError(msg);
        setIceServers(STUN_FALLBACK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCredentials();

    return () => {
      cancelled = true;
    };
  }, []); // fetch once on mount — credentials are valid for 24 h

  return { iceServers, loading, error };
};

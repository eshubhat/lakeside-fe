/**
 * useFFmpeg.ts
 * React hook wrapping @ffmpeg/ffmpeg v0.12 (single-threaded, no SharedArrayBuffer needed).
 * Loads the WASM core from unpkg CDN via blob URLs to bypass CORS.
 */

import { useState, useCallback, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export interface ExportClip {
  file: File;
  inPoint: number;  // seconds within the original file
  outPoint: number; // seconds within the original file
}

export interface ExportOptions {
  clips: ExportClip[];
  format: 'mp4' | 'webm';
  quality: 'high' | 'medium' | 'low';
  onProgress?: (pct: number, stage: string) => void;
}

// Single-threaded core (no SharedArrayBuffer required)
const CDN_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

const CRF_MAP = { high: '18', medium: '23', low: '28' } as const;

export function useFFmpeg() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState('');

  // Lazily create FFmpeg instance
  const getInstance = useCallback((): FFmpeg => {
    if (!ffmpegRef.current) ffmpegRef.current = new FFmpeg();
    return ffmpegRef.current;
  }, []);

  /** Load FFmpeg WASM core. Safe to call multiple times (idempotent). */
  const load = useCallback(async (): Promise<boolean> => {
    if (loaded) return true;
    if (loading) return false;

    setLoading(true);
    setError(null);
    setStage('Downloading FFmpeg engine…');

    try {
      const ff = getInstance();
      ff.on('log', ({ message }) => setLog(message));
      ff.on('progress', ({ progress: p }) => {
        setProgress(Math.max(0, Math.min(100, Math.round(p * 100))));
      });

      await ff.load({
        coreURL: await toBlobURL(`${CDN_BASE}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CDN_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      setLoaded(true);
      setLoading(false);
      setStage('');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load FFmpeg: ${msg}`);
      setLoading(false);
      setStage('');
      return false;
    }
  }, [loaded, loading, getInstance]);

  /**
   * Trim and optionally concatenate clips, then return a download blob URL.
   * Handles single clip (simple -ss/-to) and multiple clips (filter_complex concat).
   */
  const exportVideo = useCallback(async (opts: ExportOptions): Promise<string | null> => {
    setError(null);
    setProgress(0);

    // Ensure FFmpeg is loaded
    if (!loaded) {
      const ok = await load();
      if (!ok) return null;
    }

    const ff = getInstance();
    const { clips, format, quality, onProgress } = opts;

    if (clips.length === 0) {
      setError('No clips to export.');
      return null;
    }

    try {
      setStage('Writing files…');
      onProgress?.(2, 'Writing files…');

      const inputNames: string[] = [];
      for (let i = 0; i < clips.length; i++) {
        const safeName = `in${i}.mp4`;
        inputNames.push(safeName);
        const data = await fetchFile(clips[i].file);
        await ff.writeFile(safeName, data);
        onProgress?.(2 + Math.round((i + 1) / clips.length * 18), 'Writing files…');
      }

      setStage('Rendering…');
      onProgress?.(20, 'Rendering…');
      setProgress(20);

      const outFile = `output.${format}`;
      const codecV = format === 'webm' ? 'libvpx-vp9' : 'libx264';
      const codecA = format === 'webm' ? 'libopus' : 'aac';

      let args: string[];

      if (clips.length === 1) {
        // Simple single-clip trim — much faster
        const c = clips[0];
        args = [
          '-i', inputNames[0],
          '-ss', c.inPoint.toFixed(3),
          '-to', c.outPoint.toFixed(3),
          '-c:v', codecV,
          '-c:a', codecA,
          ...(format === 'mp4' ? ['-crf', CRF_MAP[quality], '-preset', 'fast'] : []),
          '-y', outFile,
        ];
      } else {
        // Multi-clip: trim each then concat with filter_complex
        const inputArgs = inputNames.flatMap(n => ['-i', n]);

        const filterParts: string[] = [];
        const concatIn: string[] = [];

        clips.forEach((c, i) => {
          const s = c.inPoint.toFixed(3);
          const e = c.outPoint.toFixed(3);
          filterParts.push(
            `[${i}:v]trim=start=${s}:end=${e},setpts=PTS-STARTPTS[v${i}]`,
            `[${i}:a]atrim=start=${s}:end=${e},asetpts=PTS-STARTPTS[a${i}]`,
          );
          concatIn.push(`[v${i}][a${i}]`);
        });

        const filterComplex = [
          ...filterParts,
          `${concatIn.join('')}concat=n=${clips.length}:v=1:a=1[outv][outa]`,
        ].join('; ');

        args = [
          ...inputArgs,
          '-filter_complex', filterComplex,
          '-map', '[outv]',
          '-map', '[outa]',
          '-c:v', codecV,
          '-c:a', codecA,
          ...(format === 'mp4' ? ['-crf', CRF_MAP[quality], '-preset', 'fast'] : []),
          '-y', outFile,
        ];
      }

      await ff.exec(args);

      setStage('Packaging…');
      onProgress?.(90, 'Packaging…');
      setProgress(90);

      const rawData = await ff.readFile(outFile);
      // readFile returns string | Uint8Array; always produce a plain ArrayBuffer for Blob
      const bytes = typeof rawData === 'string'
        ? new TextEncoder().encode(rawData)
        : new Uint8Array(rawData as Uint8Array);
      const blob = new Blob([bytes], { type: `video/${format}` });
      const url = URL.createObjectURL(blob);

      // Clean up virtual FS
      for (const name of inputNames) {
        await ff.deleteFile(name).catch(() => {});
      }
      await ff.deleteFile(outFile).catch(() => {});

      setProgress(100);
      setStage('Done');
      onProgress?.(100, 'Done');
      return url;

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[FFmpeg] Export failed:', msg, '\nLast log:', log);
      setError(`Export failed: ${msg}`);
      return null;
    }
  }, [loaded, load, getInstance, log]);

  return {
    loaded,
    loading,
    progress,
    stage,
    error,
    log,
    load,
    exportVideo,
  };
}

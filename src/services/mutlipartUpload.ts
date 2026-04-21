import { api } from './api';

export interface UploadProgress {
    /** Parts successfully uploaded to R2 so far */
    partsUploaded: number;
    /** Total parts attempted (including in-flight) */
    partsTotal: number;
    /** Bytes confirmed uploaded */
    bytesUploaded: number;
    /** 0-100 estimate based on parts completed */
    percent: number;
}

export interface MultipartUploaderOptions {
    /** Called after every successfully uploaded part */
    onProgress?: (progress: UploadProgress) => void;
    /** Called once the upload is fully committed on R2 */
    onComplete?: (downloadUrl: string) => void;
    /** Called if any part or finalisation fails unrecoverably */
    onError?: (error: Error) => void;
    /** Optional room ID stored in the recording document */
    roomId?: string;
}

interface CompletedPart {
    PartNumber: number;
    ETag: string;
}

/**
 * MultipartUploader
 *
 * Pipes MediaRecorder Blob chunks directly to Cloudflare R2 as they are
 * produced, so no recording data is held in RAM beyond a single in-flight part.
 *
 * Usage:
 *   const uploader = new MultipartUploader({ onProgress, onComplete, onError });
 *   await uploader.start();                      // call once before recorder.start()
 *   recorder.ondataavailable = e => uploader.addChunk(e.data);
 *   recorder.onstop = () => uploader.finalise(durationSeconds);
 *   // To cancel mid-recording:
 *   uploader.abort();
 */
export class MultipartUploader {
    private uploadId: string | null = null;
    private key: string | null = null;
    private partNumber = 0;
    private completedParts: CompletedPart[] = [];
    private bytesUploaded = 0;
    private aborted = false;
    private finalising = false;

    // Each chunk from ondataavailable is queued here and processed serially so
    // parts always arrive at R2 in order without concurrent PUT collisions.
    private queue: Blob[] = [];
    private processing = false;

    private readonly options: MultipartUploaderOptions;

    constructor(options: MultipartUploaderOptions = {}) {
        this.options = options;
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Initiates the multipart upload on R2. Must be called before addChunk().
     * Returns the object key so callers can store it if needed.
     */
    async start(mimeType = 'video/webm'): Promise<string> {
        const { data } = await api.post<{ uploadId: string; key: string }>(
            '/upload/multipart/start'
        );
        this.uploadId = data.uploadId;
        this.key = data.key;
        this.mimeType = mimeType;
        this.partNumber = 0;
        this.completedParts = [];
        this.bytesUploaded = 0;
        this.aborted = false;
        this.finalising = false;
        this.queue = [];
        this.processing = false;
        this.accumulatorOffset = 0;
        return data.key;
    }

    /**
     * Enqueues a Blob chunk produced by MediaRecorder.ondataavailable.
     * Chunks smaller than 5 MB are held and merged with the next chunk so R2's
     * minimum part size requirement is always met for non-final parts.
     *
     * Recommended MediaRecorder timeslice: 5 000 ms at 8 Mbps ≈ 5 MB/chunk.
     */
    addChunk(chunk: Blob): void {
        if (this.aborted || this.finalising) return;
        if (!chunk || chunk.size === 0) return;
        this.queue.push(chunk);
        this.processQueue();
    }

    /**
     * Flushes any remaining buffered data and finalises the multipart upload.
     * Calls onComplete with the presigned download URL once R2 confirms.
     */
    async finalise(durationSeconds?: number): Promise<void> {
        if (this.aborted) return;
        this.finalising = true;

        // Wait for the queue to drain before sending the final part
        await this.waitForQueue();

        if (this.aborted) return;

        // Flush any remaining bytes in the accumulator as the final (smaller) part
        if (this.accumulatorOffset > 0) {
            const finalPart = new Blob(
                [this.accumulator.subarray(0, this.accumulatorOffset)],
                { type: this.mimeType }
            );
            this.accumulatorOffset = 0;
            await this.uploadPart(finalPart);
        }

        if (this.completedParts.length === 0) {
            this.options.onError?.(new Error('No parts were uploaded — nothing to finalise.'));
            return;
        }

        try {
            const { data } = await api.post<{ downloadUrl: string }>('/upload/multipart/complete', {
                key: this.key,
                uploadId: this.uploadId,
                parts: this.completedParts,
                roomId: this.options.roomId,
                durationSeconds,
            });
            this.options.onComplete?.(data.downloadUrl);
        } catch (err) {
            this.options.onError?.(err instanceof Error ? err : new Error(String(err)));
        }
    }

    /**
     * Aborts the multipart upload session. Tells R2 to discard all staged parts.
     * Safe to call at any time — including mid-recording or after a call ends.
     */
    async abort(): Promise<void> {
        this.aborted = true;
        this.queue = [];
        this.accumulatorOffset = 0;

        if (this.key && this.uploadId) {
            try {
                await api.post('/upload/multipart/abort', {
                    key: this.key,
                    uploadId: this.uploadId,
                });
            } catch (e) {
                // Best-effort — a failed abort just leaves orphaned parts that R2 will
                // eventually expire. Not worth propagating to the user.
                console.warn('[MultipartUploader] Abort request failed:', e);
            }
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    // R2 requires every non-final part to be EXACTLY this size.
    // 8 MB is a safe multiple of the 5 MB minimum and gives clean boundaries.
    private readonly PART_SIZE = 8 * 1024 * 1024; // 8 MB

    // Fixed-size byte accumulator — filled from incoming chunks, flushed at
    // exactly PART_SIZE. Unlike the old Blob-merging approach, every non-final
    // part will be bit-for-bit identical in size, satisfying R2's constraint.
    private accumulator = new Uint8Array(8 * 1024 * 1024);
    private accumulatorOffset = 0;
    // Blob type carried across from the MediaRecorder mimeType
    private mimeType = 'video/webm';

    private async processQueue(): Promise<void> {
        if (this.processing) return;
        this.processing = true;

        while (this.queue.length > 0 && !this.aborted && !this.finalising) {
            const chunk = this.queue.shift()!;

            // Read the blob into a raw ArrayBuffer so we can fill the accumulator
            // at the byte level — no Blob size ambiguity
            const buffer = await chunk.arrayBuffer();
            let chunkOffset = 0;

            while (chunkOffset < buffer.byteLength) {
                const remaining = this.PART_SIZE - this.accumulatorOffset;
                const available = buffer.byteLength - chunkOffset;
                const toCopy = Math.min(remaining, available);

                this.accumulator.set(
                    new Uint8Array(buffer, chunkOffset, toCopy),
                    this.accumulatorOffset
                );
                this.accumulatorOffset += toCopy;
                chunkOffset += toCopy;

                // Accumulator is full — upload exactly PART_SIZE bytes as one part
                if (this.accumulatorOffset === this.PART_SIZE) {
                    const part = new Blob([this.accumulator], { type: this.mimeType });
                    this.accumulatorOffset = 0; // reset for next part
                    await this.uploadPart(part);
                    if (this.aborted) break;
                }
            }
        }

        this.processing = false;
    }

    private waitForQueue(): Promise<void> {
        if (!this.processing && this.queue.length === 0) {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                if (!this.processing && this.queue.length === 0) {
                    clearInterval(interval);
                    resolve();
                }
            }, 50);
        });
    }

    private async uploadPart(blob: Blob): Promise<void> {
        if (this.aborted) return;

        const currentPartNumber = ++this.partNumber;

        try {
            // 1. Ask the backend for a short-lived presigned URL for this part
            const { data } = await api.post<{ presignedUrl: string }>('/upload/multipart/part', {
                key: this.key,
                uploadId: this.uploadId,
                partNumber: currentPartNumber,
            });

            // 2. PUT the blob directly to R2 — never touches your server
            const response = await fetch(data.presignedUrl, {
                method: 'PUT',
                body: blob,
                headers: { 'Content-Type': 'video/webm' },
            });

            if (!response.ok) {
                throw new Error(`R2 rejected part ${currentPartNumber}: HTTP ${response.status}`);
            }

            // R2 returns the ETag for each part — required for CompleteMultipartUpload
            const etag = response.headers.get('ETag');
            if (!etag) {
                throw new Error(`R2 did not return ETag for part ${currentPartNumber}`);
            }

            this.completedParts.push({ PartNumber: currentPartNumber, ETag: etag });
            this.bytesUploaded += blob.size;

            this.options.onProgress?.({
                partsUploaded: this.completedParts.length,
                partsTotal: this.partNumber,
                bytesUploaded: this.bytesUploaded,
                percent: Math.round((this.completedParts.length / this.partNumber) * 100),
            });
        } catch (err) {
            // One failed part is unrecoverable in the current simple design —
            // abort the whole session so R2 cleans up staged parts.
            const error = err instanceof Error ? err : new Error(String(err));
            console.error(`[MultipartUploader] Part ${currentPartNumber} failed:`, error);
            this.aborted = true;
            this.options.onError?.(error);
            await this.abort();
        }
    }
}
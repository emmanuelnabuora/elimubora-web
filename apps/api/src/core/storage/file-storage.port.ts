/**
 * File storage boundary — same port pattern as AI/payments/push, but
 * with a genuinely different honesty story: unlike those, a
 * local-disk implementation is REAL, working storage, not a stub.
 * `LocalFileStorageProvider` (the only implementation provided)
 * actually writes and reads bytes on this server's filesystem — it
 * is a fully functional, deployable choice for a small single-region
 * deployment. Swapping to S3/Cloudflare R2 for a larger production
 * footprint is a provider registration change in CoreModule, not an
 * application-code change, following exactly the same port contract.
 */
export interface FileStorageProvider {
  /** Stores bytes under a server-generated key; returns that key. */
  put(bytes: Buffer, contentType: string): Promise<{ storageKey: string }>;
  /** Retrieves previously stored bytes, or null if the key doesn't exist. */
  get(storageKey: string): Promise<Buffer | null>;
}

export const FILE_STORAGE_PROVIDER = Symbol('FILE_STORAGE_PROVIDER');

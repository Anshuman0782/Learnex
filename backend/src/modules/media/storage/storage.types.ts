/** A file the storage driver has persisted. */
export interface StoredFile {
  /** Storage key, e.g. "avatars/uuid.jpg". */
  key: string;
  /** Public path the file is served at, e.g. "/uploads/avatars/uuid.jpg". */
  publicPath: string;
  /** Absolute URL when the driver serves files itself (cloud CDN). */
  url?: string;
}

export interface SaveInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  /** Logical folder, e.g. "avatars" or "videos". */
  subdir: string;
}

/**
 * Pluggable storage backend. The local driver writes to disk today; a cloud
 * driver (R2/Supabase, presigned) can be dropped in without touching callers.
 */
export interface StorageDriver {
  save(input: SaveInput): Promise<StoredFile>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

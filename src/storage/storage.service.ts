import { Readable } from 'node:stream';

/** DI token for the storage strategy (Strategy + Factory pattern). */
export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface PutFileInput {
  buffer: Buffer;
  mimeType: string;
  /** Original filename — used only to derive a safe extension. */
  originalName: string;
}

export interface StoredFile {
  storageKey: string;
  sizeBytes: number;
}

/**
 * Abstraction over file persistence. Swap LocalDiskStorage for S3/GCS without
 * touching any service code.
 */
export interface StorageService {
  put(input: PutFileInput): Promise<StoredFile>;
  getStream(storageKey: string): Promise<Readable>;
  remove(storageKey: string): Promise<void>;
}

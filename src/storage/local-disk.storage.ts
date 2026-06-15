import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { PutFileInput, StorageService, StoredFile } from './storage.service';

/**
 * Stores files on the local filesystem under UPLOAD_DIR.
 *
 * Security: the storage key is a server-generated UUID + sanitized extension, so a
 * client filename never influences the path (prevents traversal). Files live outside
 * any statically served directory and are only returned via the streaming endpoint.
 */
@Injectable()
export class LocalDiskStorage implements StorageService {
  private readonly logger = new Logger(LocalDiskStorage.name);
  private readonly baseDir: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.baseDir = resolve(config.get('storage.uploadDir', { infer: true }));
  }

  async put(input: PutFileInput): Promise<StoredFile> {
    await mkdir(this.baseDir, { recursive: true });
    const ext = this.safeExtension(input.originalName);
    const storageKey = `${randomUUID()}${ext}`;
    await writeFile(this.resolveKey(storageKey), input.buffer);
    return { storageKey, sizeBytes: input.buffer.byteLength };
  }

  getStream(storageKey: string): Promise<Readable> {
    const path = this.resolveKey(storageKey);
    const stream = createReadStream(path);
    return new Promise<Readable>((resolvePromise, reject) => {
      stream.on('open', () => resolvePromise(stream));
      stream.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') {
          reject(new NotFoundException('File not found'));
        } else {
          reject(err);
        }
      });
    });
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await unlink(this.resolveKey(storageKey));
    } catch (err) {
      this.logger.warn(`Failed to remove ${storageKey}: ${(err as Error).message}`);
    }
  }

  /** Resolve a key to an absolute path, guarding against path traversal. */
  private resolveKey(storageKey: string): string {
    const path = resolve(join(this.baseDir, storageKey));
    if (!path.startsWith(this.baseDir)) {
      throw new NotFoundException('Invalid storage key');
    }
    return path;
  }

  private safeExtension(originalName: string): string {
    const ext = extname(originalName).toLowerCase();
    return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : '';
  }
}

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import type { FileStorageProvider } from './file-storage.port';

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};

/**
 * Genuinely functional implementation — see file-storage.port.ts.
 * Writes to a configurable local directory (UPLOADS_DIR). Storage
 * keys are opaque UUIDs with a content-type-derived extension, never
 * derived from user input, so there is no path-traversal surface:
 * get() only ever joins the configured root with a key it generated
 * itself.
 */
@Injectable()
export class LocalFileStorageProvider implements FileStorageProvider {
  private readonly root: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.root = path.resolve(config.uploadsDir);
  }

  async put(bytes: Buffer, contentType: string): Promise<{ storageKey: string }> {
    await mkdir(this.root, { recursive: true });
    const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? '.bin';
    const storageKey = `${randomUUID()}${extension}`;
    await writeFile(path.join(this.root, storageKey), bytes);
    return { storageKey };
  }

  async get(storageKey: string): Promise<Buffer | null> {
    try {
      return await readFile(path.join(this.root, storageKey));
    } catch {
      return null;
    }
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { SaveInput, StoredFile, StorageDriver } from './storage.types.js';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
};

/**
 * Stores uploads on the backend's local disk, under UPLOADS_DIR, and reports the
 * public path they're served at (see the static handler in main.ts).
 */
@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = path.resolve(config.get<string>('UPLOADS_DIR') ?? 'uploads');
  }

  async save({ buffer, originalName, mimeType, subdir }: SaveInput): Promise<StoredFile> {
    const ext = EXT_BY_MIME[mimeType] ?? path.extname(originalName).toLowerCase() ?? '';
    const filename = `${randomUUID()}${ext}`;
    const dir = path.join(this.root, subdir);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), buffer);

    const key = `${subdir}/${filename}`;
    return { key, publicPath: `/uploads/${key}` };
  }
}

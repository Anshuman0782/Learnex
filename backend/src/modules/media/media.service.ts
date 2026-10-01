import {
  BadRequestException,
  Inject,
  Injectable,
  PayloadTooLargeException,
} from '@nestjs/common';
import { STORAGE_DRIVER, type StorageDriver, type StoredFile } from './storage/storage.types.js';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const AUDIO_TYPES = new Set([
  'audio/mpeg', // .mp3
  'audio/mp4', // .m4a
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
]);
const IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const AUDIO_MAX_BYTES = 30 * 1024 * 1024; // 30 MB

export interface UploadedResult extends StoredFile {
  mimeType: string;
  size: number;
  kind: 'image' | 'video' | 'audio';
}

@Injectable()
export class MediaService {
  constructor(@Inject(STORAGE_DRIVER) private readonly storage: StorageDriver) {}

  /** Validates type/size, routes to a subfolder, and persists via the driver. */
  async save(file: Express.Multer.File): Promise<UploadedResult> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    let kind: 'image' | 'video' | 'audio';
    let subdir: string;
    let maxBytes: number;

    if (IMAGE_TYPES.has(file.mimetype)) {
      kind = 'image';
      subdir = 'images';
      maxBytes = IMAGE_MAX_BYTES;
    } else if (VIDEO_TYPES.has(file.mimetype)) {
      kind = 'video';
      subdir = 'videos';
      maxBytes = VIDEO_MAX_BYTES;
    } else if (AUDIO_TYPES.has(file.mimetype)) {
      kind = 'audio';
      subdir = 'audio';
      maxBytes = AUDIO_MAX_BYTES;
    } else {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(
        `${kind} exceeds the ${Math.round(maxBytes / 1024 / 1024)}MB limit`,
      );
    }

    const stored = await this.storage.save({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      subdir,
    });

    return { ...stored, mimeType: file.mimetype, size: file.size, kind };
  }
}

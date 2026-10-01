import { Injectable, InternalServerErrorException, Logger, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import type { SaveInput, StoredFile, StorageDriver } from './storage.types.js';

/** Parsed `CLOUDINARY_URL` (cloudinary://<api_key>:<api_secret>@<cloud_name>). */
export interface CloudinaryCreds {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function parseCloudinaryUrl(raw?: string | null): CloudinaryCreds | null {
  if (!raw) return null;
  const m = /^cloudinary:\/\/([^:]+):([^@]+)@([A-Za-z0-9_-]+)$/.exec(raw.trim());
  return m ? { apiKey: m[1], apiSecret: m[2], cloudName: m[3] } : null;
}

/** Root folder for everything LERNEX stores in Cloudinary. */
export const CLOUD_FOLDER = 'lernex';

/**
 * Stores uploads in Cloudinary (free plan, no card). Uploads are signed on the
 * server with the API secret, so the secret never reaches the app. Images go
 * to the `image` pipeline; video AND audio go to `video` (Cloudinary's
 * resource type for both). Returns an HTTPS CDN URL.
 */
@Injectable()
export class CloudinaryStorageDriver implements StorageDriver {
  private readonly logger = new Logger(CloudinaryStorageDriver.name);
  private readonly creds: CloudinaryCreds;

  constructor(config: ConfigService) {
    const creds = parseCloudinaryUrl(config.get<string>('CLOUDINARY_URL'));
    if (!creds) throw new Error('CLOUDINARY_URL is missing or invalid');
    this.creds = creds;
  }

  private sign(params: Record<string, string>): string {
    const toSign = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    return createHash('sha1').update(toSign + this.creds.apiSecret).digest('hex');
  }

  async save({ buffer, mimeType, subdir }: SaveInput): Promise<StoredFile> {
    const resourceType = mimeType.startsWith('image/') ? 'image' : 'video';
    const folder = `${CLOUD_FOLDER}/${subdir}`;
    const publicId = randomUUID();
    const params: Record<string, string> = {
      folder,
      public_id: publicId,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), publicId);
    Object.entries(params).forEach(([k, v]) => form.append(k, v));
    form.append('api_key', this.creds.apiKey);
    form.append('signature', this.sign(params));

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${this.creds.cloudName}/${resourceType}/upload`,
      { method: 'POST', body: form },
    );
    const json = (await res.json().catch(() => null)) as
      | { secure_url?: string; public_id?: string; error?: { message?: string } }
      | null;

    if (!res.ok || !json?.secure_url) {
      const msg = json?.error?.message ?? `HTTP ${res.status}`;
      this.logger.warn(`Cloudinary upload failed: ${msg}`);
      if (res.status === 400 && /too large|file size/i.test(msg)) {
        throw new PayloadTooLargeException('This file is too large for the free media plan');
      }
      throw new InternalServerErrorException('Media upload failed. Please try again.');
    }
    return { key: json.public_id ?? `${folder}/${publicId}`, publicPath: json.secure_url, url: json.secure_url };
  }
}

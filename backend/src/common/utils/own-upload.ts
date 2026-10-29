import * as path from 'node:path';
import { CLOUD_FOLDER, parseCloudinaryUrl } from '../../modules/media/storage/cloudinary-storage.driver.js';

const LOCAL_UPLOAD = /^https?:\/\/[^\s/]+\/uploads\/(images|videos|audio|files)\/([A-Za-z0-9._-]+)$/;

/**
 * True when `url` is a file uploaded to LERNEX's own storage (our Cloudinary
 * folder in production, our /uploads folder in local development) — never an
 * arbitrary link. Used for chat attachments and AI mentor-test recordings.
 */
export function isOwnUpload(url: string): boolean {
  const cloud = parseCloudinaryUrl(process.env.CLOUDINARY_URL)?.cloudName;
  if (cloud) {
    return new RegExp(
      `^https://res\\.cloudinary\\.com/${cloud}/(image|video|raw)/upload/[A-Za-z0-9._\\-/]*${CLOUD_FOLDER}/(images|videos|audio|files)/[A-Za-z0-9._\\-]+$`,
    ).test(url);
  }
  return LOCAL_UPLOAD.test(url);
}

/**
 * For local-disk uploads (development), the file's path on disk — read it
 * directly instead of over HTTP. Null for cloud URLs.
 */
export function localUploadPath(url: string): string | null {
  if (parseCloudinaryUrl(process.env.CLOUDINARY_URL)) return null;
  const m = LOCAL_UPLOAD.exec(url);
  if (!m) return null;
  return path.join(path.resolve(process.env.UPLOADS_DIR ?? 'uploads'), m[1], m[2]);
}

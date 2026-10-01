import { uploadAsync, FileSystemUploadType, getInfoAsync, deleteAsync, documentDirectory } from 'expo-file-system/legacy';
import { API_BASE_URL } from '../config/env';
import { getAccessToken } from '../services/tokenStorage';
import { ApiError, refreshSession } from './client';

export interface UploadResponse {
  url: string;
  path: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'video' | 'audio';
}

/**
 * Uploads a local file (from the image/video/audio picker) to the backend and
 * returns its public URL.
 *
 * Expo SDK 57 ships a spec-compliant WHATWG `FormData` that rejects React
 * Native's `{ uri, name, type }` file part ("unsupported FormDataPart
 * implementation"). So we upload straight from the file URI with
 * expo-file-system's native multipart uploader, which handles `file://` and
 * `content://` URIs correctly and never touches JS FormData.
 *
 * `uri` is a device file URI; `mimeType` e.g. "image/jpeg".
 */
export async function uploadFileRequest(
  uri: string,
  mimeType: string,
  fileName?: string,
): Promise<UploadResponse> {
  const url = `${API_BASE_URL}/media/upload`;
  const name = fileName || uri.split('/').pop() || `upload-${Date.now()}`;

  const doUpload = async (token?: string) =>
    uploadAsync(url, uri, {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      parameters: { name },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  if (uri.startsWith('file://')) {
    const info = await getInfoAsync(uri).catch(() => null);
    if (!info?.exists) {
      throw new ApiError(0, 'This file is no longer available on your device. Please pick it again.');
    }
  }

  let token = (await getAccessToken()) ?? undefined;
  let res = await doUpload(token);

  // Access token likely expired — refresh once and retry.
  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      token = (await getAccessToken()) ?? undefined;
      res = await doUpload(token);
    }
  }

  if (res.status < 200 || res.status >= 300) {
    let message = `Upload failed (${res.status})`;
    try {
      const data = JSON.parse(res.body);
      if (data?.message) {
        message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      }
    } catch {
      // non-JSON body — keep default message
    }
    throw new ApiError(res.status, message);
  }

  // Remove our private copy of a picked file once it's safely uploaded.
  if (documentDirectory && uri.startsWith(`${documentDirectory}pick-`)) {
    deleteAsync(uri, { idempotent: true }).catch(() => undefined);
  }

  return JSON.parse(res.body) as UploadResponse;
}

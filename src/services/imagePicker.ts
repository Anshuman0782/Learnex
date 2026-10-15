import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Result of a media request:
 *  - 'ok'        + uri/mimeType (and durationMs for video/audio)
 *  - 'cancelled': user backed out (no error to show)
 *  - 'denied':    permission was refused (guide them to Settings)
 */
export type MediaResult =
  | { status: 'ok'; uri: string; mimeType: string; durationMs?: number }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'error'; message: string };

function audioMimeFromName(name?: string): string {
  const n = (name ?? '').toLowerCase();
  if (n.endsWith('.mp3')) return 'audio/mpeg';
  if (n.endsWith('.m4a')) return 'audio/m4a';
  if (n.endsWith('.aac')) return 'audio/aac';
  if (n.endsWith('.wav')) return 'audio/wav';
  if (n.endsWith('.ogg')) return 'audio/ogg';
  return 'audio/mpeg';
}

function imageMime(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  return asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
}

function videoMime(asset: ImagePicker.ImagePickerAsset): string {
  if (asset.mimeType) return asset.mimeType;
  const uri = asset.uri.toLowerCase();
  if (uri.endsWith('.mov')) return 'video/quicktime';
  if (uri.endsWith('.webm')) return 'video/webm';
  return 'video/mp4';
}

/**
 * Copies a picked file out of the picker's volatile cache into the app's own
 * document directory (Android can clear/revoke cache copies before upload).
 * Files are named `pick-*` and deleted automatically after a successful upload.
 */
async function persistPick(uri: string, ext: string): Promise<string> {
  try {
    const base = FileSystem.documentDirectory;
    if (!base) return uri;
    const safeExt = ext.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin';
    const dest = `${base}pick-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${safeExt}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

/** Max photos in one photo post (matches the server limit). */
export const MAX_POST_PHOTOS = 5;

export type PickedPhoto = { uri: string; mimeType: string; width?: number; height?: number };

/** Picks up to `max` photos (original aspect ratio) for a photo post. */
export async function pickPostPhotos(max: number): Promise<{ status: 'ok'; photos: PickedPhoto[] } | { status: 'cancelled' } | { status: 'denied' }> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: max > 1,
    selectionLimit: Math.max(1, max),
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  const photos: PickedPhoto[] = [];
  for (const a of result.assets.slice(0, max)) {
    const mimeType = imageMime(a);
    photos.push({ uri: await persistPick(a.uri, mimeType.split('/')[1] || 'jpg'), mimeType, width: a.width, height: a.height });
  }
  return { status: 'ok', photos };
}

/** Takes one photo with the camera for a photo post (no forced crop). */
export async function capturePostPhoto(): Promise<{ status: 'ok'; photos: PickedPhoto[] } | { status: 'cancelled' } | { status: 'denied' }> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  const a = result.assets[0];
  const mimeType = imageMime(a);
  return { status: 'ok', photos: [{ uri: await persistPick(a.uri, mimeType.split('/')[1] || 'jpg'), mimeType, width: a.width, height: a.height }] };
}

/** Opens the camera to take a square profile photo. */
export async function takePhoto(): Promise<MediaResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  return { status: 'ok', uri: result.assets[0].uri, mimeType: imageMime(result.assets[0]) };
}

/** Opens the photo library to pick a square profile photo. */
export async function pickPhoto(aspect: [number, number] = [1, 1]): Promise<MediaResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };
  // Android's system cropper doesn't reliably honour non-square ratios (it cuts
  // off a 16:9 thumbnail). For video / reel covers we take the WHOLE image; the
  // app displays it in a fixed 16:9 / 9:16 frame (centred), so nothing is lost.
  const square = aspect[0] === aspect[1];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: square,
    ...(square ? { aspect } : {}),
    quality: square ? 0.7 : 0.85,
  });
  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  return { status: 'ok', uri: result.assets[0].uri, mimeType: imageMime(result.assets[0]) };
}

/** Records a practice video with the camera. */
export async function recordVideo(): Promise<MediaResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    videoMaxDuration: 180,
    quality: 0.7,
  });
  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  const a = result.assets[0];
  return { status: 'ok', uri: a.uri, mimeType: videoMime(a), durationMs: a.duration ?? undefined };
}

/** Picks a practice video from the library. */
export async function pickVideo(): Promise<MediaResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    quality: 0.7,
  });
  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  const a = result.assets[0];
  return { status: 'ok', uri: a.uri, mimeType: videoMime(a), durationMs: a.duration ?? undefined };
}

/** Records a short vertical (9:16) video for the Reels feed. */
export async function recordShort(): Promise<MediaResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    videoMaxDuration: 60, // shorts are under a minute
    quality: 0.7,
  });
  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  const a = result.assets[0];
  return { status: 'ok', uri: a.uri, mimeType: videoMime(a), durationMs: a.duration ?? undefined };
}

/** Picks an audio file (voice take / song) from device storage. */
export async function pickAudioFile(): Promise<MediaResult> {
  // Ask for the ORIGINAL content:// URI. In Expo Go the picker's own cache copy
  // (cache/DocumentPicker/…) is outside the app's sandbox, so expo-file-system
  // refuses to read it ("isn't readable"). content:// URIs are readable, and we
  // copy them into our document directory right away (persistPick).
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    copyToCacheDirectory: false,
    multiple: false,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { status: 'cancelled' };
  }
  const a = result.assets[0];
  const mimeType = a.mimeType || audioMimeFromName(a.name);
  // Android can clear / revoke DocumentPicker's cache copy before the user
  // presses publish ("isn't readable"). Copy it into the app's own document
  // directory immediately so it's still readable at upload time.
  const uri = await persistPick(a.uri, a.name?.split('.').pop() || 'm4a');
  // If the copy failed we'd be left with a URI we may not be able to read later.
  const inSandbox = !!FileSystem.documentDirectory && uri.startsWith(FileSystem.documentDirectory);
  if (uri === a.uri && uri.startsWith('file://') && !inSandbox) {
    return { status: 'error', message: 'Could not read this audio file. Please try another file.' };
  }
  return { status: 'ok', uri, mimeType };
}

/**
 * Generates a poster thumbnail from a video's first second. Returns a local
 * image URI, or null if it fails (caller can fall back to a default poster).
 */
export async function generateVideoThumbnail(videoUri: string): Promise<string | null> {
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: 1000,
      quality: 0.7,
    });
    // getThumbnailAsync writes into the volatile cache dir, which Android can
    // clear (or make unreadable) before the user presses publish. Copy it into
    // the app's persistent document directory so it's still readable at upload.
    try {
      const base = FileSystem.documentDirectory;
      if (base) {
        const dest = `${base}thumb-${Date.now()}.jpg`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        return dest;
      }
    } catch {
      // fall through and use the cache uri
    }
    return uri;
  } catch {
    return null;
  }
}

// ---------------- Chat attachments ----------------

export type ChatAttachmentKind = 'image' | 'video' | 'audio' | 'file';

export type PickedAttachment = {
  uri: string;
  mimeType: string;
  type: ChatAttachmentKind;
  name: string;
  size?: number;
  durationMs?: number;
};

export type AttachmentResult =
  | { status: 'ok'; file: PickedAttachment }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'error'; message: string };

/** Upload limits (mirror the server's). */
export const CHAT_LIMIT_BYTES: Record<ChatAttachmentKind, number> = {
  image: 8 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  audio: 30 * 1024 * 1024,
  file: 20 * 1024 * 1024,
};

/** Document types the server accepts for chat. */
const CHAT_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
];

const DOC_MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
};

function fromImagePickerAsset(a: ImagePicker.ImagePickerAsset): PickedAttachment {
  const isVideo = a.type === 'video' || (a.mimeType ?? '').startsWith('video/');
  const mimeType = isVideo ? videoMime(a) : imageMime(a);
  const ext = isVideo ? (mimeType === 'video/quicktime' ? 'mov' : 'mp4') : mimeType === 'image/png' ? 'png' : 'jpg';
  return {
    uri: a.uri,
    mimeType,
    type: isVideo ? 'video' : 'image',
    name: a.fileName || `${isVideo ? 'video' : 'photo'}-${Date.now()}.${ext}`,
    size: a.fileSize ?? undefined,
    durationMs: isVideo ? a.duration ?? undefined : undefined,
  };
}

/** Photo or video from the gallery, for a chat message. */
export async function pickChatMedia(): Promise<AttachmentResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  return { status: 'ok', file: fromImagePickerAsset(result.assets[0]) };
}

/** Take a photo (or record a video) with the camera, for a chat message. */
export async function captureChatMedia(): Promise<AttachmentResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { status: 'denied' };
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images', 'videos'],
    videoMaxDuration: 180,
    quality: 0.8,
  });
  if (result.canceled || result.assets.length === 0) return { status: 'cancelled' };
  return { status: 'ok', file: fromImagePickerAsset(result.assets[0]) };
}

/** A document (PDF, Word, Excel, PowerPoint, text, zip) for a chat message. */
export async function pickChatDocument(): Promise<AttachmentResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: CHAT_DOC_TYPES,
    copyToCacheDirectory: false,
    multiple: false,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) return { status: 'cancelled' };
  const a = result.assets[0];
  const ext = (a.name?.split('.').pop() || '').toLowerCase();
  const mimeType = a.mimeType && CHAT_DOC_TYPES.includes(a.mimeType) ? a.mimeType : DOC_MIME_BY_EXT[ext];
  if (!mimeType) return { status: 'error', message: 'This file type can’t be sent. Try a PDF, Word, Excel, PowerPoint, text or zip file.' };
  const uri = await persistPick(a.uri, ext || 'bin');
  return {
    status: 'ok',
    file: { uri, mimeType, type: 'file', name: a.name || `document.${ext || 'bin'}`, size: a.size ?? undefined },
  };
}

/** An audio file (voice note / song) for a chat message. */
export async function pickChatAudio(): Promise<AttachmentResult> {
  const r = await pickAudioFile();
  if (r.status !== 'ok') return r;
  const ext = r.uri.split('.').pop() || 'm4a';
  return { status: 'ok', file: { uri: r.uri, mimeType: r.mimeType, type: 'audio', name: `audio-${Date.now()}.${ext}` } };
}

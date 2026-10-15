import {
  Controller,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { MediaService } from './media.service.js';

// Hard ceiling at the multer layer (service enforces tighter per-type limits).
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export interface UploadResponse {
  url: string;
  path: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'video' | 'audio' | 'file';
}

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Authenticated multipart upload. Field name: "file". Returns the public URL. */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ): Promise<UploadResponse> {
    const stored = await this.media.save(file);
    // Absolute URL built from the same host the client reached us on (works on
    // emulator and physical devices in dev without extra config).
    const origin = `${req.protocol}://${req.get('host')}`;
    return {
      url: stored.url ?? `${origin}${stored.publicPath}`,
      path: stored.publicPath,
      mimeType: stored.mimeType,
      size: stored.size,
      kind: stored.kind,
    };
  }
}

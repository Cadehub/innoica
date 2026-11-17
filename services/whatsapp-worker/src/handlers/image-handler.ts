// ====================================================================
// INNOICA WhatsApp Agents v2.0 — WhatsApp Image Media Helper
// Validation binaire, extraction descriptor et sécurité zéro fuite
// ====================================================================

import type { proto } from '@whiskeysockets/baileys';
import { unwrapProtoMessage } from './audio-handler.js';

export const MAX_IMAGE_BYTES = parseInt(
  process.env.IMAGE_MAX_BYTES || String(15 * 1024 * 1024),
  10
); // 15 MB

export const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export interface IncomingImageDescriptor {
  isImage: true;
  mimeType: string | null;
  caption: string | null;
  fileSizeBytes: number | null;
  height?: number | null;
  width?: number | null;
  url?: string | null;
  directPath?: string | null;
  mediaKey?: Uint8Array | null;
}

export function extractImageDescriptor(
  message: proto.IMessage | null | undefined
): IncomingImageDescriptor | null {
  const unwrapped = unwrapProtoMessage(message);
  const image = unwrapped?.imageMessage;
  if (!image) return null;

  const rawLength = image.fileLength;
  let fileSizeBytes: number | null = null;
  if (typeof rawLength === 'number') {
    fileSizeBytes = rawLength;
  } else if (rawLength && typeof (rawLength as any).toNumber === 'function') {
    fileSizeBytes = (rawLength as any).toNumber();
  } else if (typeof rawLength === 'string' && /^\d+$/.test(rawLength)) {
    fileSizeBytes = parseInt(rawLength, 10);
  }

  return {
    isImage: true,
    mimeType: image.mimetype || 'image/jpeg',
    caption: image.caption || null,
    fileSizeBytes,
    height: typeof image.height === 'number' ? image.height : null,
    width: typeof image.width === 'number' ? image.width : null,
    url: image.url || null,
    directPath: image.directPath || null,
    mediaKey: image.mediaKey || null,
  };
}

export function normalizeImageMime(mimeType: string | null | undefined): string {
  return (mimeType || '').split(';')[0].trim().toLowerCase();
}

export function validateImageMetadataBeforeDownload(
  descriptor: IncomingImageDescriptor
): { valid: true } | { valid: false; errorCode: string } {
  if (descriptor.fileSizeBytes !== null && descriptor.fileSizeBytes > MAX_IMAGE_BYTES) {
    return { valid: false, errorCode: 'image_too_large' };
  }
  const baseMime = normalizeImageMime(descriptor.mimeType);
  if (baseMime && !ALLOWED_IMAGE_MIMES.has(baseMime)) {
    return { valid: false, errorCode: 'unsupported_mime_type' };
  }
  return { valid: true };
}

export function inspectImageMagicBytes(buffer: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }

  // WebP: RIFF .... WEBP
  if (
    buffer.subarray(0, 4).equals(Buffer.from('RIFF')) &&
    buffer.subarray(8, 12).equals(Buffer.from('WEBP'))
  ) {
    return 'webp';
  }

  return null;
}

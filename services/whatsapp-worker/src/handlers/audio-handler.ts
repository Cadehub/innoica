// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Voice / Audio Media Helper
// Validation binaire, garde-fous Free/Paid et client local Speech Worker
// ====================================================================

import type { proto } from '@whiskeysockets/baileys';
import type { VoiceQualityCategory } from '@innoica/shared';

export const MAX_VOICE_BYTES = parseInt(process.env.VOICE_MAX_AUDIO_BYTES || String(10 * 1024 * 1024), 10);
export const MAX_VOICE_DURATION_SECONDS = parseInt(process.env.VOICE_MAX_DURATION_SEC || '300', 10);

const ALLOWED_AUDIO_MIMES = new Set([
  'audio/ogg',
  'application/ogg',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/flac',
  'audio/x-flac',
  'audio/webm',
  'video/webm',
]);

export interface IncomingAudioDescriptor {
  isAudio: true;
  mimeType: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  isVoiceNote: boolean;
}

export interface SpeechWorkerTranscriptionResponse {
  ok: boolean;
  qualityCategory: VoiceQualityCategory;
  detectedLanguage: string;
  languageProbability: number;
  transcript: string;
  durationSeconds: number;
  avgLogprob?: number | null;
  noSpeechProb?: number | null;
  speechRatio?: number;
  processingMs?: number;
  errorCode?: string | null;
}

export function unwrapProtoMessage(message: proto.IMessage | null | undefined): proto.IMessage | null {
  let current: proto.IMessage | null | undefined = message;
  for (let depth = 0; depth < 6 && current; depth++) {
    const next =
      current.ephemeralMessage?.message ||
      current.viewOnceMessage?.message ||
      current.viewOnceMessageV2?.message ||
      current.viewOnceMessageV2Extension?.message ||
      current.documentWithCaptionMessage?.message ||
      current.editedMessage?.message ||
      (current as any).deviceSentMessage?.message ||
      (current as any).associatedChildMessage?.message;
    if (!next) break;
    current = next;
  }
  return current || null;
}

export function extractAudioDescriptor(message: proto.IMessage | null | undefined): IncomingAudioDescriptor | null {
  const unwrapped = unwrapProtoMessage(message);
  const audio = unwrapped?.audioMessage;
  if (!audio) return null;

  const rawLength = audio.fileLength;
  let fileSizeBytes: number | null = null;
  if (typeof rawLength === 'number') {
    fileSizeBytes = rawLength;
  } else if (rawLength && typeof (rawLength as any).toNumber === 'function') {
    fileSizeBytes = (rawLength as any).toNumber();
  } else if (typeof rawLength === 'string' && /^\d+$/.test(rawLength)) {
    fileSizeBytes = parseInt(rawLength, 10);
  }

  return {
    isAudio: true,
    mimeType: audio.mimetype || null,
    durationSeconds: typeof audio.seconds === 'number' ? audio.seconds : null,
    fileSizeBytes,
    isVoiceNote: Boolean(audio.ptt),
  };
}

export function normalizeBaseMime(mimeType: string | null | undefined): string {
  return (mimeType || '').split(';')[0].trim().toLowerCase();
}

export function validateAudioMetadataBeforeDownload(
  descriptor: IncomingAudioDescriptor
): { valid: true } | { valid: false; errorCode: string } {
  if (descriptor.fileSizeBytes !== null && descriptor.fileSizeBytes > MAX_VOICE_BYTES) {
    return { valid: false, errorCode: 'audio_too_large' };
  }
  if (descriptor.durationSeconds !== null && descriptor.durationSeconds > MAX_VOICE_DURATION_SECONDS) {
    return { valid: false, errorCode: 'audio_too_long' };
  }
  const baseMime = normalizeBaseMime(descriptor.mimeType);
  if (baseMime && !ALLOWED_AUDIO_MIMES.has(baseMime)) {
    return { valid: false, errorCode: 'unsupported_mime_type' };
  }
  return { valid: true };
}

export function inspectAudioMagicBytes(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) return null;
  if (buffer.subarray(0, 4).equals(Buffer.from('OggS'))) return 'ogg';
  if (buffer.subarray(0, 4).equals(Buffer.from('RIFF')) && buffer.subarray(8, 12).equals(Buffer.from('WAVE'))) {
    return 'wav';
  }
  if (buffer.subarray(0, 4).equals(Buffer.from('fLaC'))) return 'flac';
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'webm';
  if (buffer.subarray(4, 8).equals(Buffer.from('ftyp'))) return 'mp4';
  if (
    buffer.subarray(0, 3).equals(Buffer.from('ID3')) ||
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  ) {
    return 'mp3';
  }
  return null;
}

export async function requestSpeechTranscription(params: {
  speechWorkerEndpoint: string;
  audioBuffer: Buffer;
  claimedMime?: string | null;
  correlationId: string;
  workerSecret?: string;
}): Promise<SpeechWorkerTranscriptionResponse> {
  const endpoint = params.speechWorkerEndpoint.replace(/\/+$/, '');
  const form = new FormData();
  const mime = params.claimedMime || 'application/octet-stream';
  const blob = new Blob([Uint8Array.from(params.audioBuffer)], { type: mime });
  form.append('file', blob, 'voice-message');

  const response = await fetch(`${endpoint}/api/transcribe`, {
    method: 'POST',
    headers: {
      'x-worker-secret': params.workerSecret || process.env.WORKER_INTERNAL_SECRET || '',
      ...(params.claimedMime ? { 'x-claimed-mime': params.claimedMime } : {}),
      'x-correlation-id': params.correlationId,
    },
    body: form,
    signal: AbortSignal.timeout(40000),
  });

  if (!response.ok) {
    throw new Error(`Speech worker HTTP ${response.status}`);
  }

  return (await response.json()) as SpeechWorkerTranscriptionResponse;
}

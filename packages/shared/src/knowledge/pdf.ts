// ====================================================================
// INNOICA Agent Studio — Safe PDF Magic-Byte Validation & Text Extraction
// ====================================================================

import { APP_CONFIG } from '../constants/index';

export function isValidPdfSignature(buffer: Uint8Array): boolean {
  if (!buffer || buffer.byteLength < 5) {
    return false;
  }
  // Vérifier la signature magique %PDF-
  const header = String.fromCharCode(
    buffer[0],
    buffer[1],
    buffer[2],
    buffer[3],
    buffer[4]
  );
  return header === '%PDF-';
}

export async function extractTextFromPdfBuffer(
  buffer: Uint8Array,
  maxBytes: number = APP_CONFIG.limits.maxPdfSizeBytes
): Promise<{ text: string; totalPages: number }> {
  if (!buffer || buffer.byteLength === 0) {
    throw new Error('Le fichier PDF est vide.');
  }

  if (buffer.byteLength > maxBytes) {
    throw new Error(
      `Fichier PDF trop volumineux (max ${Math.round(maxBytes / (1024 * 1024))} Mo).`
    );
  }

  if (!isValidPdfSignature(buffer)) {
    throw new Error('Signature de fichier PDF invalide (%PDF- manquant).');
  }

  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { totalPages, text } = await extractText(pdf, { mergePages: true });

  const cleanText = (text || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!cleanText) {
    throw new Error(
      'Aucun texte extractible trouvé dans ce PDF (document scanné ou protégé).'
    );
  }

  return { text: cleanText, totalPages };
}

// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Text Chunker & RAG Preprocessor
// ====================================================================

export interface TextChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

/**
 * Nettoie le texte brut (suppression des sauts de ligne excessifs, normalisation des espaces)
 */
export function cleanRawText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/**
 * Découpe un texte propre en fragments (chunks) avec chevauchement (overlap)
 */
export function splitTextIntoChunks(
  text: string,
  chunkSize = 800,
  overlap = 100
): TextChunk[] {
  const cleaned = cleanRawText(text);
  if (!cleaned) return [];

  if (cleaned.length <= chunkSize) {
    return [
      {
        chunkIndex: 0,
        content: cleaned,
        tokenCount: Math.ceil(cleaned.length / 4),
      },
    ];
  }

  const chunks: TextChunk[] = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < cleaned.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= cleaned.length) {
      endIndex = cleaned.length;
    } else {
      // Chercher une coupure propre (fin de phrase ou saut de paragraphe)
      const slice = cleaned.slice(startIndex, endIndex);
      const lastParagraph = slice.lastIndexOf('\n\n');
      const lastSentence = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));

      if (lastParagraph > chunkSize * 0.5) {
        endIndex = startIndex + lastParagraph + 2;
      } else if (lastSentence > chunkSize * 0.5) {
        endIndex = startIndex + lastSentence + 2;
      }
    }

    const chunkContent = cleaned.slice(startIndex, endIndex).trim();
    if (chunkContent.length > 0) {
      chunks.push({
        chunkIndex,
        content: chunkContent,
        tokenCount: Math.ceil(chunkContent.length / 4),
      });
      chunkIndex++;
    }

    if (endIndex >= cleaned.length) {
      break;
    }

    startIndex = endIndex - overlap;
  }

  return chunks;
}

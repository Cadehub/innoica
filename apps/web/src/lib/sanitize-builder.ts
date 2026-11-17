// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Store Builder Anti-XSS & Sanitizer
// Zero dangerouslySetInnerHTML, strict link and text sanitization (Requirement R4)
// ====================================================================

/**
 * Nettoie et valide une URL de lien ou d'image.
 * Autorise uniquement les ancres relatives ('#...'), chemins internes ('/...'),
 * ou URLs externes sécurisées ('https://' ou 'http://').
 * Rejette formellement les protocoles dangereux ('javascript:', 'data:', 'vbscript:')
 * ainsi que toute tentative d'injection HTML.
 */
export function sanitizeUrl(url?: string | null, fallback: string = '#'): string {
  if (!url) return fallback;
  const trimmed = url.trim();
  if (!trimmed) return fallback;

  const lower = trimmed.toLowerCase();

  // Rejet immédiat des schémas dangereux et caractères d'injection HTML
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.includes('<') ||
    lower.includes('>') ||
    lower.includes('"') ||
    lower.includes("'") ||
    lower.includes('`')
  ) {
    return fallback;
  }

  // Autoriser les ancres internes (#catalog, #about, etc.)
  if (trimmed.startsWith('#')) {
    return trimmed;
  }

  // Autoriser les chemins relatifs (/store/..., /catalog, etc.)
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  // Autoriser uniquement HTTP/HTTPS
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return fallback;
}

/**
 * Supprime les balises HTML et les scripts pour empêcher toute injection XSS.
 * Renvoie un texte pur nettoyé.
 */
export function sanitizeText(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Store Builder Anti-XSS & Sanitizer
// Zero dangerouslySetInnerHTML, strict link and text sanitization (Requirement R4)
// ====================================================================

/**
 * Nettoie et valide une URL de lien ou d'image.
 * Autorise uniquement les ancres relatives ('#...'), chemins internes ('/...', hors '//...'),
 * ou URLs externes sécurisées ('https://' ou 'http://').
 * Rejette formellement les protocoles dangereux ('javascript:', 'data:', 'vbscript:')
 * ainsi que toute tentative d'injection HTML ou URL relative de protocole ('//').
 */
export function sanitizeUrl(url?: string | null, fallback: string = '#'): string {
  if (!url) return fallback;
  // Supprimer les caractères de contrôle invisibles utilisés pour contourner les filtres (ex: java\tscript:)
  const trimmed = url.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  if (!trimmed) return fallback;

  const lower = trimmed.toLowerCase();

  // Rejet immédiat des schémas dangereux, URLs protocol-relative (// ou /\), backslashes et caractères d'injection HTML
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    trimmed.startsWith('/\\') ||
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

  // Autoriser les chemins relatifs internes (/store/..., /catalog, etc.)
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

/**
 * Extrait le premier numéro camerounais/WhatsApp depuis les réglages du builder ou la description
 */
export function extractMerchantPhone(
  builderLayout: any,
  fallbackDescription?: string | null
): string {
  const sections = Array.isArray(builderLayout?.sections) ? builderLayout.sections : [];
  for (const type of ['about', 'footer']) {
    const sec = sections.find((s: any) => s?.type === type);
    const phone = sec?.settings?.contactPhone;
    if (typeof phone === 'string' && phone.replace(/\D/g, '').length >= 8) {
      return phone.trim();
    }
  }
  if (fallbackDescription) {
    const match = fallbackDescription.match(/(?:\+?237[\s.-]?)?[26](?:[\s.-]?\d){8}/);
    if (match) {
      return match[0].trim();
    }
  }
  return '';
}

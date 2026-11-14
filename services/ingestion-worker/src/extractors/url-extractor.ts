// ====================================================================
// INNOICA WhatsApp Agents v2.0 — SSRF-Protected Web Scraping Extractor
// ====================================================================

import { validateUrlForSsrf } from '@innoica/shared';

export interface WebExtractionResult {
  title: string;
  content: string;
  resolvedIp?: string;
}

/**
 * Extrait le contenu texte lisible d'un document HTML
 */
export function extractTextFromHtml(html: string): { title: string; content: string } {
  // Extraction du titre
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Page Web';

  // Nettoyage des balises script, style, nav, footer, iframe
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // Remplacer les balises de paragraphe et saut par des retours à la ligne
  cleaned = cleaned
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/li>/gi, '\n');

  // Supprimer toutes les autres balises HTML
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // Décoder les entités HTML courantes
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return {
    title,
    content: cleaned.trim(),
  };
}

/**
 * Récupère et extrait le contenu textuel d'une URL publique après validation anti-SSRF
 */
export async function scrapePublicUrl(url: string, timeoutMs = 10000): Promise<WebExtractionResult> {
  // 1. Validation Anti-SSRF stricte (inviolable)
  const ssrfCheck = await validateUrlForSsrf(url);
  if (!ssrfCheck.isSafe) {
    throw new Error(`Sécurité SSRF bloquée : ${ssrfCheck.reason}`);
  }

  // 2. Requête HTTP contrôlée avec signal d'abandon (Timeout)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'INNOICA-Knowledge-Crawler/2.0 (+https://agents.innoica.com)',
        Accept: 'text/html,application/xhtml+xml,text/plain',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error(`Erreur HTTP ${res.status}: ${res.statusText}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      throw new Error(`Type de contenu non supporté : ${contentType}`);
    }

    const rawBody = await res.text();
    const { title, content } = extractTextFromHtml(rawBody);

    return {
      title,
      content,
      resolvedIp: ssrfCheck.resolvedIp,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Timeout dépassé (${timeoutMs}ms) lors de la récupération de l'URL`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

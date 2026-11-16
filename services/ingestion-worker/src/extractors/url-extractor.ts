// ====================================================================
// INNOICA WhatsApp Agents v2.0 — SSRF-Protected Web Scraping Extractor
// ====================================================================

import { safeFetchPublicUrl } from '@innoica/shared/server';
import { sanitizeKnowledgeContent } from '@innoica/shared';

export interface WebExtractionResult {
  title: string;
  content: string;
  resolvedIp?: string;
}

/**
 * Extrait le contenu texte lisible d'un document HTML
 */
export function extractTextFromHtml(html: string): { title: string; content: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Page Web';

  const collectedParts: string[] = [];

  const metaDesc =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  if (metaDesc && metaDesc[1]) {
    collectedParts.push(`Description : ${metaDesc[1].trim()}`);
  }

  const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  if (ogDesc && ogDesc[1] && (!metaDesc || metaDesc[1] !== ogDesc[1])) {
    collectedParts.push(`Présentation : ${ogDesc[1].trim()}`);
  }

  const metaKeywords = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i);
  if (metaKeywords && metaKeywords[1]) {
    collectedParts.push(`Mots-clés / Activités : ${metaKeywords[1].trim()}`);
  }

  const jsonLdRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const traverse = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        if (obj.name && typeof obj.name === 'string') {
          let line = `- ${obj.name}`;
          if (obj.price) line += ` : ${obj.price} ${obj.priceCurrency || 'FCFA'}`;
          if (obj.description) line += ` (${obj.description})`;
          collectedParts.push(line);
        }
        if (obj.telephone) collectedParts.push(`Téléphone : ${obj.telephone}`);
        if (obj.email) collectedParts.push(`Email : ${obj.email}`);
        if (obj.priceRange) collectedParts.push(`Tarifs : ${obj.priceRange}`);
        if (obj.addressLocality) collectedParts.push(`Ville : ${obj.addressLocality}, ${obj.addressCountry || 'Cameroun'}`);
        if (obj.opens && obj.closes) collectedParts.push(`Horaires : ${obj.opens} - ${obj.closes}`);
        for (const k of Object.keys(obj)) {
          if (typeof obj[k] === 'object') traverse(obj[k]);
        }
      };
      traverse(data);
    } catch {}
  }

  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const bodyText = sanitizeKnowledgeContent(cleaned);
  if (bodyText.length > 40) {
    collectedParts.push(`Contenu principal :\n${bodyText}`);
  }

  const merged = collectedParts.join('\n\n').trim();

  return {
    title,
    content: sanitizeKnowledgeContent(merged || bodyText || title),
  };
}

/**
 * Récupère et extrait le contenu textuel d'une URL publique après validation anti-SSRF
 */
export async function scrapePublicUrl(url: string, timeoutMs = 10000): Promise<WebExtractionResult> {
  const fetched = await safeFetchPublicUrl(url, { timeoutMs });
  if (fetched.contentType.includes('text/plain')) {
    return {
      title: 'Document Texte',
      content: sanitizeKnowledgeContent(fetched.body),
      resolvedIp: fetched.resolvedIp,
    };
  }

  const { title, content } = extractTextFromHtml(fetched.body);
  return {
    title,
    content,
    resolvedIp: fetched.resolvedIp,
  };
}

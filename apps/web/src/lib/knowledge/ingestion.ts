import { safeFetchPublicUrl } from '@innoica/shared/server';
import { sanitizeKnowledgeContent } from '@innoica/shared';

export interface TextChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

export function cleanRawText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

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
      const slice = cleaned.slice(startIndex, endIndex);
      const lastParagraph = slice.lastIndexOf('\n\n');
      const lastSentence = Math.max(
        slice.lastIndexOf('. '),
        slice.lastIndexOf('! '),
        slice.lastIndexOf('? ')
      );

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

    startIndex = Math.max(endIndex - overlap, startIndex + 1);
  }

  return chunks;
}

export function extractTextFromHtml(html: string): { title: string; content: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Page Web';

  const collectedParts: string[] = [];

  // 1. Méta-description & OpenGraph
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

  // 2. Schémas JSON-LD (Schema.org / Services / Produits / Catalogues / Tarifs)
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
        if (obj.opens && obj.closes) collectedParts.push(`Horaires d'ouverture : ${obj.opens} - ${obj.closes}`);
        for (const k of Object.keys(obj)) {
          if (typeof obj[k] === 'object') traverse(obj[k]);
        }
      };
      traverse(data);
    } catch {
      // Ignorer les blocs JSON-LD malformés
    }
  }

  // 3. Nettoyage du corps HTML visible
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const bodyText = cleanRawText(cleaned);
  if (bodyText.length > 40) {
    collectedParts.push(`Contenu principal :\n${bodyText}`);
  }

  const merged = collectedParts.join('\n\n').trim();

  return {
    title,
    content: merged || bodyText || title,
  };
}

export async function scrapePublicUrl(
  url: string,
  timeoutMs = 10000
): Promise<{ title: string; content: string }> {
  const fetched = await safeFetchPublicUrl(url, { timeoutMs });
  if (fetched.contentType.includes('text/plain')) {
    return {
      title: 'Document Texte',
      content: sanitizeKnowledgeContent(cleanRawText(fetched.body)),
    };
  }

  const extracted = extractTextFromHtml(fetched.body);
  const sanitized = sanitizeKnowledgeContent(extracted.content);
  if (!sanitized) {
    throw new Error('Aucun contenu textuel exploitable trouvé sur cette URL.');
  }

  return {
    title: extracted.title,
    content: sanitized,
  };
}

export class KnowledgePlanLimitError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 403) {
    super(message);
    this.statusCode = statusCode;
  }
}

export async function verifyAgentAccess(supabase: any, agentId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: 'Non authentifié', status: 401 as const, agent: null };
  }

  const { data: agent, error } = await supabase
    .from('agents')
    .select('id, workspace_id, name')
    .eq('id', agentId)
    .single();

  if (error || !agent) {
    return { error: 'Agent introuvable ou accès refusé', status: 404 as const, agent: null };
  }

  return { error: null, status: 200 as const, agent };
}

export async function persistKnowledgeSource(
  supabase: any,
  params: {
    agentId: string;
    sourceType: 'faq' | 'txt' | 'url' | 'pdf';
    title: string;
    rawContent: string;
    sourceUrl?: string;
  }
) {
  const { agentId, sourceType, title, sourceUrl } = params;
  const rawContent = sanitizeKnowledgeContent(params.rawContent);

  const { data: agent } = await supabase
    .from('agents')
    .select('id, workspace_id')
    .eq('id', agentId)
    .single();

  if (!agent) {
    throw new KnowledgePlanLimitError('Agent introuvable ou accès refusé.', 404);
  }

  const { data: planRows } = await supabase.rpc('resolve_effective_workspace_plan', {
    p_workspace_id: agent.workspace_id,
  });
  const plan = Array.isArray(planRows) ? planRows[0] : planRows;

  if (plan) {
    if (plan.workspace_status && plan.workspace_status !== 'active') {
      throw new KnowledgePlanLimitError('Ce workspace est suspendu.', 403);
    }

    const allowedTypes: string[] = Array.isArray(plan.allowed_knowledge_types)
      ? plan.allowed_knowledge_types
      : ['faq', 'txt'];

    if (!allowedTypes.includes(sourceType)) {
      throw new KnowledgePlanLimitError(
        `Le type de connaissance « ${sourceType.toUpperCase()} » nécessite le plan Starter.`,
        403
      );
    }

    if (typeof plan.max_knowledge_docs === 'number') {
      const { data: wsAgents } = await supabase
        .from('agents')
        .select('id')
        .eq('workspace_id', agent.workspace_id);
      const agentIds = (wsAgents || []).map((a: any) => a.id);

      const { count } = await supabase
        .from('agent_knowledge_sources')
        .select('id', { count: 'exact', head: true })
        .in('agent_id', agentIds.length > 0 ? agentIds : [agentId]);

      if ((count ?? 0) >= plan.max_knowledge_docs) {
        throw new KnowledgePlanLimitError(
          `Limite de connaissances atteinte (${plan.max_knowledge_docs} documents maximum sur votre plan ${plan.plan_slug === 'free' ? 'Free' : 'Starter'}).`,
          403
        );
      }
    }
  }

  const chunks = splitTextIntoChunks(rawContent);

  if (chunks.length === 0) {
    throw new Error('Le contenu est vide après nettoyage.');
  }

  const { data: source, error: sourceErr } = await supabase
    .from('agent_knowledge_sources')
    .insert({
      agent_id: agentId,
      source_type: sourceType,
      title,
      source_url: sourceUrl || null,
      raw_content: rawContent,
      status: 'processing',
    })
    .select('*')
    .single();

  if (sourceErr || !source) {
    throw new Error(`Erreur création source : ${sourceErr?.message || 'inconnue'}`);
  }

  const chunkInserts = chunks.map((c) => ({
    source_id: source.id,
    agent_id: agentId,
    chunk_index: c.chunkIndex,
    content: c.content,
    token_count: c.tokenCount,
  }));

  const { error: chunkErr } = await supabase
    .from('agent_knowledge_chunks')
    .insert(chunkInserts);

  if (chunkErr) {
    await supabase.from('agent_knowledge_sources').delete().eq('id', source.id);
    throw new Error(`Erreur indexation fragments : ${chunkErr.message}`);
  }

  const { data: updatedSource } = await supabase
    .from('agent_knowledge_sources')
    .update({ status: 'ready', updated_at: new Date().toISOString() })
    .eq('id', source.id)
    .select('*')
    .single();

  return {
    source: updatedSource || { ...source, status: 'ready' },
    chunkCount: chunks.length,
  };
}

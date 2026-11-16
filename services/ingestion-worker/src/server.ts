// ====================================================================
// INNOICA Agent Studio — Ingestion Worker Fastify Server
// ====================================================================

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { createWorkerSupabaseClient } from '@innoica/database';
import {
  APP_CONFIG,
  knowledgeFaqSchema,
  knowledgeUrlSchema,
  sanitizeKnowledgeContent,
} from '@innoica/shared';
import { extractTextFromPdfBuffer } from '@innoica/shared/server';
import { splitTextIntoChunks } from './chunker.js';
import { scrapePublicUrl } from './extractors/url-extractor.js';

async function persistSourceAndChunks(
  supabase: any,
  params: {
    agentId: string;
    sourceType: 'faq' | 'txt' | 'url' | 'pdf';
    title: string;
    rawContent: string;
    sourceUrl?: string;
  }
) {
  const sanitized = sanitizeKnowledgeContent(params.rawContent);
  const chunks = splitTextIntoChunks(sanitized);
  if (chunks.length === 0) {
    throw new Error('Le contenu est vide après nettoyage.');
  }

  const { data: source, error: sourceErr } = await supabase
    .from('agent_knowledge_sources')
    .insert({
      agent_id: params.agentId,
      source_type: params.sourceType,
      title: params.title,
      source_url: params.sourceUrl || null,
      raw_content: sanitized,
      status: 'processing',
    })
    .select('id')
    .single();

  if (sourceErr || !source) {
    throw new Error(`Erreur création source: ${sourceErr?.message}`);
  }

  const chunkInserts = chunks.map((c) => ({
    source_id: source.id,
    agent_id: params.agentId,
    chunk_index: c.chunkIndex,
    content: c.content,
    token_count: c.tokenCount,
  }));

  const { error: chunkErr } = await supabase.from('agent_knowledge_chunks').insert(chunkInserts);
  if (chunkErr) {
    await supabase.from('agent_knowledge_sources').delete().eq('id', source.id);
    throw new Error(`Erreur insertion chunks: ${chunkErr.message}`);
  }

  await supabase
    .from('agent_knowledge_sources')
    .update({ status: 'ready', updated_at: new Date().toISOString() })
    .eq('id', source.id);

  return { sourceId: source.id, chunkCount: chunks.length };
}

export function createIngestionServer(customSupabase?: any): FastifyInstance {
  const app = Fastify({ logger: true, bodyLimit: 15 * 1024 * 1024 });
  const supabase = customSupabase || createWorkerSupabaseClient();

  app.register(cors, { origin: '*' });

  app.get('/health', async () => {
    return {
      status: 'healthy',
      service: 'innoica-ingestion-worker',
      timestamp: new Date().toISOString(),
    };
  });

  app.post('/api/ingest/faq', async (request, reply) => {
    const parseRes = knowledgeFaqSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseRes.error.format() });
    }

    const { agentId, question, answer } = parseRes.data;
    const formattedFaq = `Question: ${question}\nRéponse: ${answer}`;

    try {
      const result = await persistSourceAndChunks(supabase, {
        agentId,
        sourceType: 'faq',
        title: question,
        rawContent: formattedFaq,
      });

      return reply.send({ success: true, ...result });
    } catch (err: any) {
      request.log.error(err, `Erreur ingestion FAQ agent ${agentId}`);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  app.post<{
    Body: {
      agentId: string;
      title: string;
      content: string;
    };
  }>('/api/ingest/txt', async (request, reply) => {
    const { agentId, title, content } = request.body || {};
    if (!agentId || !title || !content) {
      return reply.status(400).send({ error: 'agentId, title et content sont requis' });
    }

    try {
      const result = await persistSourceAndChunks(supabase, {
        agentId,
        sourceType: 'txt',
        title: title.trim(),
        rawContent: content,
      });
      return reply.send({ success: true, ...result });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  app.post('/api/ingest/url', async (request, reply) => {
    const parseRes = knowledgeUrlSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseRes.error.format() });
    }

    const { agentId, title, url } = parseRes.data;

    try {
      const scrapeResult = await scrapePublicUrl(url);
      const result = await persistSourceAndChunks(supabase, {
        agentId,
        sourceType: 'url',
        title: title?.trim() || scrapeResult.title,
        rawContent: scrapeResult.content,
        sourceUrl: url,
      });

      return reply.send({
        success: true,
        ...result,
        extractedTitle: scrapeResult.title,
      });
    } catch (err: any) {
      request.log.error(err, `Erreur scraping/ingestion URL agent ${agentId}`);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  app.post<{
    Body: {
      agentId: string;
      title?: string;
      fileBase64: string;
    };
  }>('/api/ingest/pdf', async (request, reply) => {
    const { agentId, title, fileBase64 } = request.body || {};
    if (!agentId || !fileBase64) {
      return reply.status(400).send({ error: 'agentId et fileBase64 sont requis' });
    }

    try {
      const buffer = Buffer.from(fileBase64, 'base64');
      const extracted = await extractTextFromPdfBuffer(
        buffer,
        APP_CONFIG.limits.maxPdfSizeBytes
      );

      const result = await persistSourceAndChunks(supabase, {
        agentId,
        sourceType: 'pdf',
        title: title?.trim() || 'Document PDF',
        rawContent: extracted.text,
      });

      return reply.send({
        success: true,
        ...result,
        totalPages: extracted.totalPages,
      });
    } catch (err: any) {
      request.log.error(err, `Erreur ingestion PDF agent ${agentId}`);
      return reply.status(400).send({ success: false, error: err.message });
    }
  });

  app.delete<{ Params: { sourceId: string } }>('/api/sources/:sourceId', async (request, reply) => {
    const { sourceId } = request.params;
    try {
      await supabase.from('agent_knowledge_sources').delete().eq('id', sourceId);
      return reply.send({ success: true, message: 'Source supprimée avec succès' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  return app;
}

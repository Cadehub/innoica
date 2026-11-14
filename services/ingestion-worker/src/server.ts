// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Ingestion Worker Fastify Server
// ====================================================================

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { createWorkerSupabaseClient } from '@innoica/database';
import { splitTextIntoChunks } from './chunker.js';
import { scrapePublicUrl } from './extractors/url-extractor.js';
import { knowledgeFaqSchema, knowledgeUrlSchema } from '@innoica/shared';

export function createIngestionServer(customSupabase?: any): FastifyInstance {
  const app = Fastify({ logger: true });
  const supabase = customSupabase || createWorkerSupabaseClient();

  app.register(cors, { origin: '*' });

  // Health check
  app.get('/health', async () => {
    return { status: 'healthy', service: 'innoica-ingestion-worker', timestamp: new Date().toISOString() };
  });

  // 1. Ingestion de FAQ manuelle
  app.post('/api/ingest/faq', async (request, reply) => {
    const parseRes = knowledgeFaqSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseRes.error.format() });
    }

    const { agentId, question, answer } = parseRes.data;
    const formattedFaq = `Question: ${question}\nRéponse: ${answer}`;

    try {
      // Créer la source de connaissances
      const { data: source, error: sourceErr } = await supabase
        .from('agent_knowledge_sources')
        .insert({
          agent_id: agentId,
          source_type: 'faq',
          title: question,
          raw_content: formattedFaq,
          status: 'processing',
        })
        .select('id')
        .single();

      if (sourceErr || !source) {
        throw new Error(`Erreur création source: ${sourceErr?.message}`);
      }

      // Découper en chunks
      const chunks = splitTextIntoChunks(formattedFaq);
      const chunkInserts = chunks.map((c) => ({
        source_id: source.id,
        agent_id: agentId,
        chunk_index: c.chunkIndex,
        content: c.content,
        token_count: c.tokenCount,
      }));

      const { error: chunkErr } = await supabase.from('agent_knowledge_chunks').insert(chunkInserts);
      if (chunkErr) {
        throw new Error(`Erreur insertion chunks: ${chunkErr.message}`);
      }

      // Marquer la source prête
      await supabase
        .from('agent_knowledge_sources')
        .update({ status: 'ready', updated_at: new Date().toISOString() })
        .eq('id', source.id);

      return reply.send({
        success: true,
        sourceId: source.id,
        chunkCount: chunks.length,
      });
    } catch (err: any) {
      request.log.error(err, `Erreur ingestion FAQ agent ${agentId}`);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 2. Ingestion de document texte (TXT)
  app.post<{
    Body: {
      agentId: string;
      title: string;
      content: string;
    };
  }>('/api/ingest/txt', async (request, reply) => {
    const { agentId, title, content } = request.body;
    if (!agentId || !title || !content) {
      return reply.status(400).send({ error: 'agentId, title et content sont requis' });
    }

    try {
      const { data: source, error: sourceErr } = await supabase
        .from('agent_knowledge_sources')
        .insert({
          agent_id: agentId,
          source_type: 'txt',
          title,
          raw_content: content,
          status: 'processing',
        })
        .select('id')
        .single();

      if (sourceErr || !source) {
        throw new Error(`Erreur création source: ${sourceErr?.message}`);
      }

      const chunks = splitTextIntoChunks(content);
      const chunkInserts = chunks.map((c) => ({
        source_id: source.id,
        agent_id: agentId,
        chunk_index: c.chunkIndex,
        content: c.content,
        token_count: c.tokenCount,
      }));

      await supabase.from('agent_knowledge_chunks').insert(chunkInserts);

      await supabase
        .from('agent_knowledge_sources')
        .update({ status: 'ready', updated_at: new Date().toISOString() })
        .eq('id', source.id);

      return reply.send({ success: true, sourceId: source.id, chunkCount: chunks.length });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 3. Ingestion d'URL web publique (avec protection SSRF)
  app.post('/api/ingest/url', async (request, reply) => {
    const parseRes = knowledgeUrlSchema.safeParse(request.body);
    if (!parseRes.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseRes.error.format() });
    }

    const { agentId, title, url } = parseRes.data;

    try {
      // 1. Scraping sécurisé anti-SSRF
      const scrapeResult = await scrapePublicUrl(url);

      // 2. Création de la source
      const { data: source, error: sourceErr } = await supabase
        .from('agent_knowledge_sources')
        .insert({
          agent_id: agentId,
          source_type: 'url',
          title: title || scrapeResult.title,
          source_url: url,
          raw_content: scrapeResult.content,
          status: 'processing',
        })
        .select('id')
        .single();

      if (sourceErr || !source) {
        throw new Error(`Erreur création source: ${sourceErr?.message}`);
      }

      // 3. Découpage et indexation
      const chunks = splitTextIntoChunks(scrapeResult.content);
      const chunkInserts = chunks.map((c) => ({
        source_id: source.id,
        agent_id: agentId,
        chunk_index: c.chunkIndex,
        content: c.content,
        token_count: c.tokenCount,
      }));

      await supabase.from('agent_knowledge_chunks').insert(chunkInserts);

      await supabase
        .from('agent_knowledge_sources')
        .update({ status: 'ready', updated_at: new Date().toISOString() })
        .eq('id', source.id);

      return reply.send({
        success: true,
        sourceId: source.id,
        extractedTitle: scrapeResult.title,
        chunkCount: chunks.length,
      });
    } catch (err: any) {
      request.log.error(err, `Erreur scraping/ingestion URL agent ${agentId}`);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 4. Suppression d'une source et de ses fragments
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

// ====================================================================
// INNOICA WhatsApp Agents v2.0 — AI Runtime Fastify Server
// ====================================================================

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { AIOrchestrator } from './orchestrator.js';
import { testProviderKey } from './adapters/index.js';
import { AIProvider } from '@innoica/shared';

export function createAIRuntimeServer(orchestrator: AIOrchestrator): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, { origin: '*' });

  // Health check
  app.get('/health', async () => {
    return { status: 'healthy', service: 'innoica-ai-runtime', timestamp: new Date().toISOString() };
  });

  // 1. Endpoint de génération de réponse IA
  app.post<{
    Body: {
      agentId: string;
      conversationId: string;
      contactPhoneNumber: string;
      replyJid?: string;
      incomingMessage: string;
      incomingMessageType?: 'text' | 'audio';
      voiceContext?: Record<string, unknown>;
      idempotencyKey?: string;
    };
  }>('/api/generate-response', async (request, reply) => {
    const {
      agentId,
      conversationId,
      contactPhoneNumber,
      replyJid,
      incomingMessage,
      incomingMessageType,
      voiceContext,
      idempotencyKey,
    } = request.body;

    const isAudio = incomingMessageType === 'audio';
    if (!agentId || !conversationId || !contactPhoneNumber || (!incomingMessage && !isAudio)) {
      return reply.status(400).send({
        error: 'Champs obligatoires manquants (agentId, conversationId, contactPhoneNumber, incomingMessage)',
      });
    }

    try {
      const result = await orchestrator.generateAndSendResponse({
        agentId,
        conversationId,
        contactPhoneNumber,
        replyJid,
        incomingMessage: incomingMessage || '',
        ...(incomingMessageType ? { incomingMessageType } : {}),
        ...(voiceContext !== undefined ? { voiceContext: voiceContext as any } : {}),
        ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
      });

      return reply.send(result);
    } catch (err: any) {
      request.log.error(err, `Erreur génération réponse agent ${agentId}`);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Erreur interne AI Runtime',
      });
    }
  });

  // 2. Endpoint de test de clé API BYOK
  app.post<{
    Body: {
      provider: AIProvider;
      apiKey: string;
    };
  }>('/api/test-provider-key', async (request, reply) => {
    const { provider, apiKey } = request.body;

    if (!provider || !apiKey) {
      return reply.status(400).send({ error: 'Fournisseur et clé API requis' });
    }

    const testResult = await testProviderKey(provider, apiKey);
    return reply.send(testResult);
  });

  return app;
}

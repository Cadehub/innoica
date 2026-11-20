// ====================================================================
// INNOICA WhatsApp Agents v2.0 — AI Runtime Fastify Server
// ====================================================================

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { AIOrchestrator } from './orchestrator.js';
import { testProviderKey } from './adapters/index.js';
import type { AIProvider, TriggerType } from '@innoica/shared';
import { AutomationEngine } from './automation/engine.js';
import { AIWorkflowCompiler } from './automation/ai-compiler.js';

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
      incomingMessageType?: 'text' | 'audio' | 'image';
      voiceContext?: Record<string, unknown>;
      imageContext?: {
        mimeType: string;
        base64Data?: string;
        caption?: string;
        isCorrupted?: boolean;
      };
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
      imageContext,
      idempotencyKey,
    } = request.body;

    const isAudio = incomingMessageType === 'audio';
    const isImage = incomingMessageType === 'image';
    if (!agentId || !conversationId || !contactPhoneNumber || (!incomingMessage && !isAudio && !isImage)) {
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
        ...(imageContext !== undefined ? { imageContext: imageContext as any } : {}),
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

  // 3. Automation Engine Endpoints
  const automationEngine = new AutomationEngine();
  const aiCompiler = new AIWorkflowCompiler();

  // Background Sweep pour temporisations (wait_delay) et timeouts (wait_for_message)
  const sweepInterval = setInterval(() => {
    automationEngine.processWaitingTimeoutsAndDelays().catch((err) => {
      app.log.error(err, 'Erreur sweep timeouts/delays automation');
    });
  }, 10000);

  app.addHook('onClose', (_instance, done) => {
    clearInterval(sweepInterval);
    done();
  });

  // 3.1 Compiler une consigne en langage naturel
  app.post<{
    Body: {
      instruction: string;
      agentId?: string;
      workspaceId?: string;
      preferredDomain?: any;
      locale?: 'fr' | 'en';
    };
  }>('/api/automation/compile', async (request, reply) => {
    const { instruction, agentId, workspaceId, preferredDomain, locale } = request.body;
    if (!instruction) {
      return reply.status(400).send({ error: 'Instruction requise' });
    }
    const result = await aiCompiler.compile(instruction, {
      agentId,
      workspaceId,
      preferredDomain,
      locale,
    });
    return reply.send(result);
  });

  // 3.2 Vérifier si un message entrant réveille un workflow en attente ou si un état d'attente est actif
  app.post<{
    Body: {
      agentId: string;
      senderPhone: string;
      messageText?: string;
      conversationId?: string;
    };
  }>('/api/automation/check-waiting', async (request, reply) => {
    const { agentId, senderPhone, messageText, conversationId } = request.body;
    if (!agentId || !senderPhone) {
      return reply.status(400).send({ error: 'agentId et senderPhone requis' });
    }
    const resumedCount = await automationEngine.checkAndResumeWaitingWorkflows(
      agentId,
      senderPhone,
      messageText || ''
    );
    const isWaiting =
      resumedCount === 0 &&
      (await automationEngine.hasActiveWaitingWorkflow(agentId, senderPhone, conversationId));

    return reply.send({ ok: true, resumedCount, isWaiting });
  });

  // 3.3 Déclencher un workflow d'automatisation
  app.post<{
    Body: {
      workspaceId: string;
      agentId?: string;
      triggerType: TriggerType;
      payload: Record<string, unknown>;
      idempotencyKey?: string;
    };
  }>('/api/automation/dispatch', async (request, reply) => {
    const { workspaceId, agentId, triggerType, payload, idempotencyKey } = request.body;
    if (!workspaceId || !triggerType) {
      return reply.status(400).send({ error: 'workspaceId et triggerType requis' });
    }
    try {
      const executions = await automationEngine.dispatchEvent(
        workspaceId,
        agentId || null,
        triggerType,
        payload || {},
        idempotencyKey
      );

      const contactPhone = String(
        (payload?.contact as Record<string, unknown>)?.phone ||
        payload?.contactPhoneNumber ||
        ''
      );
      const conversationId = String(payload?.conversationId || '');
      const hasWaitingInExecutions = executions.some(
        (e) => e.status === 'waiting' || e.status === 'needs_approval'
      );
      const hasWaitingInDb =
        agentId && (contactPhone || conversationId)
          ? await automationEngine.hasActiveWaitingWorkflow(agentId, contactPhone, conversationId)
          : false;

      const hasWaitingWorkflow = hasWaitingInExecutions || hasWaitingInDb;

      return reply.send({
        ok: true,
        executionsCount: executions.length,
        hasWaitingWorkflow,
        executions,
      });
    } catch (err: any) {
      request.log.error(err, 'Erreur dispatch automation');
      return reply.status(500).send({ error: err.message || 'Erreur interne automation' });
    }
  });

  // 3.4 Reprendre une exécution après décision d'approbation humaine
  app.post<{
    Body: {
      executionId: string;
      decision: 'approved' | 'rejected';
      approverId?: string;
    };
  }>('/api/automation/resume-approval', async (request, reply) => {
    const { executionId, decision, approverId } = request.body;
    if (!executionId || !decision) {
      return reply.status(400).send({ error: 'executionId et decision requis' });
    }
    try {
      const ok = await automationEngine.resumeApprovedExecution(executionId, decision, approverId);
      return reply.send({ ok });
    } catch (err: any) {
      request.log.error(err, `Erreur resume-approval pour execution ${executionId}`);
      return reply.status(500).send({ error: err.message || 'Erreur reprise approbation' });
    }
  });

  // 3.5 Balayage manuel des temporisations et expirations (sweep)
  app.post('/api/automation/sweep-waiting', async () => {
    return automationEngine.processWaitingTimeoutsAndDelays();
  });

  return app;
}

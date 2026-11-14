// ====================================================================
// INNOICA WhatsApp Agents v2.0 — WhatsApp Worker Fastify Server
// ====================================================================

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { WhatsAppSessionManager } from './session-manager.js';
import { WhatsAppMessageHandler } from './handlers/message-handler.js';
import { requestPairingCodeSchema } from '@innoica/shared';

export function createWorkerServer(sessionManager: WhatsAppSessionManager): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: '*',
  });

  // Health check
  app.get('/health', async () => {
    return { status: 'healthy', service: 'innoica-whatsapp-worker', timestamp: new Date().toISOString() };
  });

  // 1. Demande de Pairing Code (PAIRING CODE ONLY — NO QR CODE)
  app.post('/api/sessions/pair', async (request, reply) => {
    const parseResult = requestPairingCodeSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.format(),
      });
    }

    const { agentId, phoneNumber } = parseResult.data;

    try {
      const result = await sessionManager.startSession(agentId, phoneNumber);
      return reply.send({
        success: true,
        agentId,
        phoneNumber,
        status: result.status,
        pairingCode: result.pairingCode,
        message: result.pairingCode
          ? 'Pairing Code généré. Saisissez ce code dans WhatsApp > Appareils connectés > Associer avec un numéro.'
          : 'Session déjà enregistrée.',
      });
    } catch (err: any) {
      request.log.error(err, `Erreur pairing pour agent ${agentId}`);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Échec de la génération du Pairing Code',
      });
    }
  });

  // 2. Consultation de l'état de la session
  app.get<{ Params: { agentId: string } }>('/api/sessions/:agentId/status', async (request, reply) => {
    const { agentId } = request.params;
    const sessionStatus = sessionManager.getSessionStatus(agentId);
    return reply.send(sessionStatus);
  });

  // 3. Envoi de message sortant
  app.post<{
    Params: { agentId: string };
    Body: { toPhone: string; text: string };
  }>('/api/sessions/:agentId/send', async (request, reply) => {
    const { agentId } = request.params;
    const { toPhone, text } = request.body;

    if (!toPhone || !text) {
      return reply.status(400).send({ error: 'toPhone et text sont requis' });
    }

    try {
      const result = await sessionManager.sendMessage(agentId, toPhone, text);
      return reply.send({
        success: true,
        messageId: result.messageId,
      });
    } catch (err: any) {
      request.log.error(err, `Erreur envoi message WhatsApp agent ${agentId}`);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Échec d\'envoi du message',
      });
    }
  });

  // 4. Déconnexion et révocation d'une session
  app.post<{ Params: { agentId: string } }>('/api/sessions/:agentId/disconnect', async (request, reply) => {
    const { agentId } = request.params;
    try {
      await sessionManager.destroySession(agentId);
      return reply.send({ success: true, message: 'Session fermée et révoquée avec succès' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  return app;
}

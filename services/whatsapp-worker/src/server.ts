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

  // 2b. Vérification active du WebSocket WhatsApp (IQ ping temps réel)
  app.post<{ Params: { agentId: string } }>('/api/sessions/:agentId/ping', async (request, reply) => {
    const { agentId } = request.params;
    const health = await sessionManager.verifySessionHealth(agentId);
    return reply.send(health);
  });

  // 3. Envoi de message sortant
  app.post<{
    Params: { agentId: string };
    Body: {
      toPhone: string;
      text?: string;
      mediaUrl?: string;
      mediaType?: 'image' | 'document' | 'audio';
      fileName?: string;
      caption?: string;
    };
  }>('/api/sessions/:agentId/send', async (request, reply) => {
    const { agentId } = request.params;
    const { toPhone, text, mediaUrl, mediaType, fileName, caption } = request.body || {};

    if (!toPhone || (!text && !mediaUrl)) {
      return reply.status(400).send({ error: 'toPhone et text (ou mediaUrl) sont requis' });
    }

    try {
      if (mediaUrl) {
        const result = await sessionManager.sendMediaMessage(agentId, toPhone, {
          type: mediaType || 'image',
          url: mediaUrl,
          fileName,
          caption: caption || text || '',
        });
        return reply.send({
          success: true,
          messageId: result.messageId,
        });
      }

      const result = await sessionManager.sendMessage(agentId, toPhone, text || '');
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

  // 3a-bis. Envoi direct d'un message multimédia (image, PDF, audio)
  app.post<{
    Params: { agentId: string };
    Body: {
      toPhone: string;
      mediaUrl: string;
      mediaType?: 'image' | 'document' | 'audio';
      fileName?: string;
      caption?: string;
    };
  }>('/api/sessions/:agentId/send-media', async (request, reply) => {
    const { agentId } = request.params;
    const { toPhone, mediaUrl, mediaType, fileName, caption } = request.body || {};

    if (!toPhone || !mediaUrl) {
      return reply.status(400).send({ error: 'toPhone et mediaUrl sont requis' });
    }

    try {
      const result = await sessionManager.sendMediaMessage(agentId, toPhone, {
        type: mediaType || 'image',
        url: mediaUrl,
        fileName,
        caption,
      });
      return reply.send({
        success: true,
        messageId: result.messageId,
      });
    } catch (err: any) {
      request.log.error(err, `Erreur envoi média agent ${agentId}`);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Échec d\'envoi du média',
      });
    }
  });

  // 3b. Mise à jour du statut de présence (composing / typing, paused, available)
  app.post<{
    Params: { agentId: string };
    Body: { toPhone?: string; presence: 'composing' | 'paused' | 'recording' | 'available' };
  }>('/api/sessions/:agentId/presence', async (request, reply) => {
    const { agentId } = request.params;
    const { toPhone, presence } = request.body || {};

    if (!presence) {
      return reply.status(400).send({ error: 'presence est requis' });
    }

    try {
      await sessionManager.sendPresence(agentId, toPhone || '', presence);
      return reply.send({ success: true, agentId, presence });
    } catch (err: any) {
      request.log.error(err, `Erreur envoi présence agent ${agentId}`);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Échec de la mise à jour de présence',
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

  // 5. Gestion des Groupes WhatsApp
  // 5.1 Récupérer tous les groupes participants
  app.get<{ Params: { agentId: string } }>('/api/sessions/:agentId/groups', async (request, reply) => {
    const { agentId } = request.params;
    try {
      const groups = await sessionManager.fetchParticipatingGroups(agentId);
      return reply.send({ success: true, groups });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 5.2 Métadonnées détaillées d'un groupe
  app.get<{ Params: { agentId: string; groupJid: string } }>(
    '/api/sessions/:agentId/groups/:groupJid',
    async (request, reply) => {
      const { agentId, groupJid } = request.params;
      try {
        const metadata = await sessionManager.getGroupMetadata(agentId, groupJid);
        return reply.send({ success: true, metadata });
      } catch (err: any) {
        return reply.status(500).send({ success: false, error: err.message });
      }
    }
  );

  // 5.3 Envoi d'un message dans un groupe
  app.post<{
    Params: { agentId: string };
    Body: { groupJid: string; text: string };
  }>('/api/sessions/:agentId/groups/send', async (request, reply) => {
    const { agentId } = request.params;
    const { groupJid, text } = request.body || {};

    if (!groupJid || !text) {
      return reply.status(400).send({ error: 'groupJid et text sont requis' });
    }

    try {
      const result = await sessionManager.sendMessage(agentId, groupJid, text);
      return reply.send({ success: true, messageId: result.messageId });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 5.4 Gestion des participants (action = add | remove | promote | demote)
  app.post<{
    Params: { agentId: string };
    Body: { groupJid: string; participants: string[]; action: 'add' | 'remove' | 'promote' | 'demote' };
  }>('/api/sessions/:agentId/groups/participants', async (request, reply) => {
    const { agentId } = request.params;
    const { groupJid, participants, action } = request.body || {};

    if (!groupJid || !participants || !action) {
      return reply.status(400).send({ error: 'groupJid, participants et action sont requis' });
    }

    try {
      const res = await sessionManager.manageGroupParticipants(agentId, groupJid, participants, action);
      return reply.send({ success: true, result: res });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 5.5 Paramètres de groupe (announcement | not_announcement | locked | unlocked)
  app.post<{
    Params: { agentId: string };
    Body: { groupJid: string; setting: 'announcement' | 'not_announcement' | 'locked' | 'unlocked' };
  }>('/api/sessions/:agentId/groups/settings', async (request, reply) => {
    const { agentId } = request.params;
    const { groupJid, setting } = request.body || {};

    if (!groupJid || !setting) {
      return reply.status(400).send({ error: 'groupJid et setting sont requis' });
    }

    try {
      const res = await sessionManager.updateGroupSettings(agentId, groupJid, setting);
      return reply.send({ success: true, result: res });
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message });
    }
  });

  // 6. Chaînes WhatsApp (Newsletters)
  app.get<{ Params: { agentId: string; channelJid: string } }>(
    '/api/sessions/:agentId/channels/:channelJid',
    async (request, reply) => {
      const { agentId, channelJid } = request.params;
      try {
        const metadata = await sessionManager.getChannelMetadata(agentId, channelJid);
        return reply.send({ success: true, metadata });
      } catch (err: any) {
        return reply.status(500).send({ success: false, error: err.message });
      }
    }
  );

  return app;
}

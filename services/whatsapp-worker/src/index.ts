// ====================================================================
// INNOICA WhatsApp Agents v2.0 — WhatsApp Worker Main Entry Point
// ====================================================================

import dotenv from 'dotenv';
dotenv.config({ path: '../../.env.local' });
dotenv.config();

import { WhatsAppSessionManager } from './session-manager.js';
import { WhatsAppMessageHandler } from './handlers/message-handler.js';
import { createWorkerServer } from './server.js';

const PORT = parseInt(process.env.WHATSAPP_WORKER_PORT || '4001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const sessionManager = new WhatsAppSessionManager(process.env.SESSIONS_DIR || './sessions');
  const messageHandler = new WhatsAppMessageHandler(
    process.env.AI_RUNTIME_URL || 'http://localhost:4002',
    {
      speechWorkerEndpoint: process.env.SPEECH_WORKER_URL || 'http://localhost:4004',
      mediaDownloader: (agentId, msg) => sessionManager.downloadIncomingMediaBuffer(agentId, msg),
      presenceSender: (agentId, toJid, presence) => sessionManager.sendPresence(agentId, toJid, presence),
    }
  );

  // Relier le gestionnaire de messages au manager de session
  sessionManager.setIncomingMessageHandler(async (agentId, msg) => {
    await messageHandler.handleIncomingMessage(agentId, msg);
  });

  const server = createWorkerServer(sessionManager);

  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`[WA-Worker] innoica-whatsapp-worker en écoute sur http://${HOST}:${PORT}`);
    console.log(`[WA-Worker] Règle active : PAIRING CODE UNIQUEMENT (Zéro QR Code)`);
    await sessionManager.restoreAllSessions();
  } catch (err) {
    console.error('[WA-Worker] Erreur démarrage serveur:', err);
    process.exit(1);
  }
}

main();

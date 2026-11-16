// ====================================================================
// INNOICA WhatsApp Agents v2.0 — AI Runtime Main Entry Point
// ====================================================================

import dotenv from 'dotenv';
dotenv.config({ path: '../../.env.local' });
dotenv.config();

import { AIOrchestrator } from './orchestrator.js';
import { createAIRuntimeServer } from './server.js';

const PORT = parseInt(process.env.AI_RUNTIME_PORT || '4002', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const orchestrator = new AIOrchestrator(process.env.WHATSAPP_WORKER_URL || 'http://localhost:4001');
  const server = createAIRuntimeServer(orchestrator);

  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`[AI-Runtime] 🧠 innoica-ai-runtime en écoute sur http://${HOST}:${PORT}`);
    console.log(`[AI-Runtime] 🛡️ Double vérification atomique Human Takeover active`);
  } catch (err) {
    console.error('[AI-Runtime] Erreur démarrage serveur:', err);
    process.exit(1);
  }
}

main();

// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Ingestion Worker Main Entry Point
// ====================================================================

import dotenv from 'dotenv';
dotenv.config({ path: '../../.env.local' });
dotenv.config();

import { createIngestionServer } from './server.js';

const PORT = parseInt(process.env.INGESTION_WORKER_PORT || '4003', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const server = createIngestionServer();

  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`[Ingestion-Worker] 📚 innoica-ingestion-worker en écoute sur http://${HOST}:${PORT}`);
    console.log(`[Ingestion-Worker] 🛡️ Protection SSRF stricte active sur toutes les requêtes HTTP`);
  } catch (err) {
    console.error('[Ingestion-Worker] Erreur démarrage serveur:', err);
    process.exit(1);
  }
}

main();

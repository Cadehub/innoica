import { describe, it, expect, vi } from 'vitest';
import { createIngestionServer } from '../server.js';
import { extractTextFromHtml } from '../extractors/url-extractor.js';

describe('Ingestion Worker API & Extractor Tests', () => {
  it('GET /health should return service health', async () => {
    const app = createIngestionServer();
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('innoica-ingestion-worker');
  });

  it('POST /api/ingest/faq should validate inputs', async () => {
    const app = createIngestionServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/ingest/faq',
      payload: {
        agentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        // missing question and answer
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /api/ingest/url should reject private localhost URLs due to SSRF protection', async () => {
    const app = createIngestionServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/ingest/url',
      payload: {
        agentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        title: 'Mon Intranet Privé',
        url: 'http://127.0.0.1:8080/admin',
      },
    });

    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.error).toContain('Sécurité SSRF');
  });

  it('should clean HTML tags and scripts properly from raw web pages', () => {
    const rawHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bienvenue chez INNOICA</title>
          <script>console.log("malicious or tracker code");</script>
          <style>.header { color: red; }</style>
        </head>
        <body>
          <nav><a href="/">Accueil</a></nav>
          <h1>Solutions d'automatisation IA</h1>
          <p>Nous simplifions vos processus d'affaires avec des agents connectés sur WhatsApp.</p>
          <footer>Tous droits réservés &copy; 2026 INNOICA</footer>
        </body>
      </html>
    `;

    const extracted = extractTextFromHtml(rawHtml);
    expect(extracted.title).toBe('Bienvenue chez INNOICA');
    expect(extracted.content).toContain("Solutions d'automatisation IA");
    expect(extracted.content).toContain('Nous simplifions vos processus');
    expect(extracted.content).not.toContain('malicious');
    expect(extracted.content).not.toContain('.header { color: red; }');
  });
});

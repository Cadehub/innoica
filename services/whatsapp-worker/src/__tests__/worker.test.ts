import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWorkerServer } from '../server.js';
import { WhatsAppSessionManager } from '../session-manager.js';

describe('innoica-whatsapp-worker API Tests', () => {
  let sessionManagerMock: WhatsAppSessionManager;

  beforeEach(() => {
    sessionManagerMock = {
      startSession: vi.fn().mockResolvedValue({
        status: 'pairing',
        pairingCode: 'ABCD-1234',
      }),
      getSessionStatus: vi.fn().mockReturnValue({
        status: 'pairing',
        pairingCode: 'ABCD-1234',
      }),
      sendMessage: vi.fn().mockResolvedValue({
        messageId: 'WA-MSG-998877',
      }),
      sendMediaMessage: vi.fn().mockResolvedValue({
        messageId: 'WA-MSG-MEDIA-123',
      }),
      sendPresence: vi.fn().mockResolvedValue(undefined),
      destroySession: vi.fn().mockResolvedValue(undefined),
    } as unknown as WhatsAppSessionManager;
  });

  it('GET /health should return service health status', async () => {
    const app = createWorkerServer(sessionManagerMock);
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('innoica-whatsapp-worker');
  });

  it('POST /api/sessions/pair should reject invalid phone numbers', async () => {
    const app = createWorkerServer(sessionManagerMock);
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions/pair',
      payload: {
        agentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        phoneNumber: '0612345678', // Invalid local format (missing +)
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('Validation failed');
  });

  it('POST /api/sessions/pair should generate a Pairing Code without any QR code', async () => {
    const app = createWorkerServer(sessionManagerMock);
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions/pair',
      payload: {
        agentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        phoneNumber: '+237691234567', // Valid international format
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.pairingCode).toBe('ABCD-1234');
    expect(body.status).toBe('pairing');

    // VERIFICATION STRICTE NON NÉGOCIABLE : AUCUN QR CODE DANS LA RÉPONSE
    expect(body).not.toHaveProperty('qr');
    expect(body).not.toHaveProperty('qrCode');
    expect(res.body.toLowerCase()).not.toContain('qr');
  });

  it('POST /api/sessions/:agentId/send should send message and return real messageId', async () => {
    const app = createWorkerServer(sessionManagerMock);
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/send',
      payload: {
        toPhone: '+237691234567',
        text: 'Bonjour, bienvenue chez INNOICA !',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.messageId).toBe('WA-MSG-998877');
  });

  it('POST /api/sessions/:agentId/send-media should send media attachment and return messageId', async () => {
    const app = createWorkerServer(sessionManagerMock);
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/send-media',
      payload: {
        toPhone: '+237691234567',
        mediaUrl: 'https://example.com/catalog.pdf',
        mediaType: 'document',
        fileName: 'catalogue.pdf',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.messageId).toBe('WA-MSG-MEDIA-123');
    expect(sessionManagerMock.sendMediaMessage).toHaveBeenCalled();
  });

  it('POST /api/sessions/:agentId/disconnect should revoke session cleanly', async () => {
    const app = createWorkerServer(sessionManagerMock);
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/disconnect',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(sessionManagerMock.destroySession).toHaveBeenCalledWith('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
  });

  it('POST /api/sessions/:agentId/presence should update presence status', async () => {
    const app = createWorkerServer(sessionManagerMock);
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions/a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/presence',
      payload: {
        toPhone: '+237691234567',
        presence: 'composing',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.presence).toBe('composing');
    expect(sessionManagerMock.sendPresence).toHaveBeenCalledWith(
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      '+237691234567',
      'composing'
    );
  });
});

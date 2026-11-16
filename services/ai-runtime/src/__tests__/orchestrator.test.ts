import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAIRuntimeServer } from '../server.js';
import { AIOrchestrator } from '../orchestrator.js';

describe('innoica-ai-runtime Tests & Human Takeover Verification', () => {
  let orchestratorMock: AIOrchestrator;

  beforeEach(() => {
    orchestratorMock = {
      generateAndSendResponse: vi.fn(),
    } as unknown as AIOrchestrator;
  });

  it('GET /health should return service health', async () => {
    const app = createAIRuntimeServer(orchestratorMock);
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('innoica-ai-runtime');
  });

  it('POST /api/generate-response should reject missing fields', async () => {
    const app = createAIRuntimeServer(orchestratorMock);
    const res = await app.inject({
      method: 'POST',
      url: '/api/generate-response',
      payload: {
        agentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        // missing conversationId, contactPhoneNumber, incomingMessage
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('should abort generation if conversation is in Human Takeover mode', async () => {
    orchestratorMock.generateAndSendResponse = vi.fn().mockResolvedValue({
      success: false,
      abortedReason: 'Réponse IA bloquée : mode de conversation = human_takeover',
    });

    const app = createAIRuntimeServer(orchestratorMock);
    const res = await app.inject({
      method: 'POST',
      url: '/api/generate-response',
      payload: {
        agentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        conversationId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        contactPhoneNumber: '+237691234567',
        incomingMessage: 'Bonjour',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.abortedReason).toContain('human_takeover');
  });

  it('should abort if atomic double-check detects human handoff during LLM call', async () => {
    orchestratorMock.generateAndSendResponse = vi.fn().mockResolvedValue({
      success: false,
      abortedReason: 'Interception Human Takeover : la réponse générée a été annulée car un humain a repris la main.',
    });

    const app = createAIRuntimeServer(orchestratorMock);
    const res = await app.inject({
      method: 'POST',
      url: '/api/generate-response',
      payload: {
        agentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        conversationId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        contactPhoneNumber: '+237691234567',
        incomingMessage: 'Quel est votre tarif ?',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.abortedReason).toContain('Interception Human Takeover');
  });

  it('should return success and messageId when AI Active completes normally', async () => {
    orchestratorMock.generateAndSendResponse = vi.fn().mockResolvedValue({
      success: true,
      reply: 'Bienvenue chez INNOICA ! Que puis-je faire pour vous ?',
      messageId: 'WA-MSG-12345',
    });

    const app = createAIRuntimeServer(orchestratorMock);
    const res = await app.inject({
      method: 'POST',
      url: '/api/generate-response',
      payload: {
        agentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        conversationId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        contactPhoneNumber: '+237691234567',
        incomingMessage: 'Bonjour !',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.messageId).toBe('WA-MSG-12345');
    expect(body.reply).toBe('Bienvenue chez INNOICA ! Que puis-je faire pour vous ?');
  });

  it('should forward replyJid for @lid / WhatsApp JID routing', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      success: true,
      reply: 'Bonjour !',
      messageId: 'WA-LID-1',
    });
    orchestratorMock.generateAndSendResponse = mockFn;

    const app = createAIRuntimeServer(orchestratorMock);
    const res = await app.inject({
      method: 'POST',
      url: '/api/generate-response',
      payload: {
        agentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        conversationId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        contactPhoneNumber: '+237691234567',
        replyJid: '123456789012345@lid',
        incomingMessage: 'Bonsoir',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(mockFn).toHaveBeenCalledWith({
      agentId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      conversationId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
      contactPhoneNumber: '+237691234567',
      replyJid: '123456789012345@lid',
      incomingMessage: 'Bonsoir',
    });
  });
});

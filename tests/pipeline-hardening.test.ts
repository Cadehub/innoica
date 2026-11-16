// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Pipeline Hardening & Ingestion Tests
// Tests for LID Normalization, Session Restoration, Groq Adapter & Error Logging
// ====================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGroq } from '../services/ai-runtime/src/adapters/groq.js';
import { WhatsAppMessageHandler } from '../services/whatsapp-worker/src/handlers/message-handler.js';
import { WhatsAppSessionManager } from '../services/whatsapp-worker/src/session-manager.js';
import { createWorkerServer } from '../services/whatsapp-worker/src/server.js';
import { createAIRuntimeServer } from '../services/ai-runtime/src/server.js';
import { AIOrchestrator } from '../services/ai-runtime/src/orchestrator.js';
import type { proto } from '@whiskeysockets/baileys';
import fs from 'fs/promises';
import path from 'path';

describe('Pipeline Hardening & Verification Suite', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ------------------------------------------------------------------
  // 1. Groq Adapter Hardening
  // ------------------------------------------------------------------
  describe('Groq Adapter Hardening', () => {
    it('should include reasoning_format: "hidden" and default max_tokens: 3072 in request body', async () => {
      let capturedBody: any = null;

      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: 'Bonjour ! Comment puis-je vous aider ?',
                },
              },
            ],
          }),
        } as Response;
      });

      const reply = await callGroq({
        apiKey: 'gsk_mock_test_key',
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Bonjour' }],
      });

      expect(reply).toBe('Bonjour ! Comment puis-je vous aider ?');
      expect(capturedBody).not.toBeNull();
      expect(capturedBody.max_tokens).toBe(3072);
      expect(capturedBody.reasoning_format).toBe('hidden');
      expect(capturedBody.model).toBe('openai/gpt-oss-120b');
    });

    it('should respect custom maxTokens if provided', async () => {
      let capturedBody: any = null;

      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [
              {
                message: {
                  content: 'OK',
                },
              },
            ],
          }),
        } as Response;
      });

      await callGroq({
        apiKey: 'gsk_mock_test_key',
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Test' }],
        maxTokens: 4096,
      });

      expect(capturedBody.max_tokens).toBe(4096);
    });

    it('should fallback to reasoning field when content is empty or whitespace', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: '   ',
                reasoning: 'Voici la réponse déduite de la réflexion.',
              },
            },
          ],
        }),
      } as Response);

      const reply = await callGroq({
        apiKey: 'gsk_mock_test_key',
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: 'Question' }],
      });

      expect(reply).toBe('Voici la réponse déduite de la réflexion.');
    });

    it('should throw an informative error when both content and reasoning are missing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: '',
                reasoning: '',
              },
            },
          ],
        }),
      } as Response);

      await expect(
        callGroq({
          apiKey: 'gsk_mock_test_key',
          model: 'openai/gpt-oss-120b',
          messages: [{ role: 'user', content: 'Question' }],
        })
      ).rejects.toThrow('Groq: Aucune réponse retournée par le modèle');
    });
  });

  // ------------------------------------------------------------------
  // 2. WhatsApp Message Handler LID & JID Normalization
  // ------------------------------------------------------------------
  describe('WhatsApp LID & JID Normalization', () => {
    let handler: WhatsAppMessageHandler;
    let mockSupabase: any;

    beforeEach(() => {
      handler = new WhatsAppMessageHandler('http://localhost:4002');
      mockSupabase = {
        rpc: vi.fn(),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { workspace_id: 'ws-123' }, error: null }),
            }),
          }),
        }),
      };
      (handler as any).supabase = mockSupabase;
    });

    it('should properly normalize bare numeric altJid into +237... contactPhoneNumber while routing to raw LID', async () => {
      let ingestedContactPhone = '';
      let dispatchedPayload: any = null;

      mockSupabase.rpc.mockImplementation((rpcName: string, params: any) => {
        if (rpcName === 'worker_ingest_inbound_message') {
          ingestedContactPhone = params.p_contact_phone;
          return Promise.resolve({
            data: {
              ok: true,
              agentStatus: 'active',
              conversationId: 'conv-lid-1',
              controlMode: 'ai_active',
              messageId: 'msg-lid-1',
              workspaceId: 'ws-123',
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      (handler as any).dispatchToAiRuntime = vi.fn().mockImplementation((payload: any) => {
        dispatchedPayload = payload;
        return Promise.resolve();
      });

      const simulatedMsg: proto.IWebMessageInfo = {
        key: {
          remoteJid: '119018576986173@lid',
          id: 'WA-MSG-LID-1',
          fromMe: false,
        } as any,
        message: {
          conversation: 'Bonjour depuis LID',
        },
      };
      // Baileys sets remoteJidAlt to bare number e.g. "237654016097"
      (simulatedMsg.key as any).remoteJidAlt = '237654016097';

      await handler.handleIncomingMessage('agent-123', simulatedMsg);

      // Verify contact phone is properly normalized with + and real digits, NOT the LID
      expect(ingestedContactPhone).toBe('+237654016097');
      expect(dispatchedPayload).not.toBeNull();
      expect(dispatchedPayload.contactPhoneNumber).toBe('+237654016097');
      // Crucial: Destination replyJid must be the raw LID so Baileys sends to the active chat
      expect(dispatchedPayload.replyJid).toBe('119018576986173@lid');
    });

    it('should properly normalize altJid with device suffix (e.g. 237654016097:1@s.whatsapp.net)', async () => {
      let ingestedContactPhone = '';

      mockSupabase.rpc.mockImplementation((rpcName: string, params: any) => {
        if (rpcName === 'worker_ingest_inbound_message') {
          ingestedContactPhone = params.p_contact_phone;
          return Promise.resolve({
            data: {
              ok: true,
              agentStatus: 'active',
              conversationId: 'conv-lid-2',
              controlMode: 'ai_active',
              messageId: 'msg-lid-2',
              workspaceId: 'ws-123',
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      (handler as any).dispatchToAiRuntime = vi.fn().mockResolvedValue(undefined);

      const simulatedMsg: proto.IWebMessageInfo = {
        key: {
          remoteJid: '119018576986173@lid',
          id: 'WA-MSG-LID-2',
          fromMe: false,
        } as any,
        message: {
          conversation: 'Test altJid device suffix',
        },
      };
      (simulatedMsg.key as any).remoteJidAlt = '237654016097:1@s.whatsapp.net';

      await handler.handleIncomingMessage('agent-123', simulatedMsg);

      expect(ingestedContactPhone).toBe('+237654016097');
    });

    it('should handle standard non-LID JIDs (@s.whatsapp.net) correctly', async () => {
      let ingestedContactPhone = '';
      let dispatchedReplyJid = '';

      mockSupabase.rpc.mockImplementation((rpcName: string, params: any) => {
        if (rpcName === 'worker_ingest_inbound_message') {
          ingestedContactPhone = params.p_contact_phone;
          return Promise.resolve({
            data: {
              ok: true,
              agentStatus: 'active',
              conversationId: 'conv-std-1',
              controlMode: 'ai_active',
              messageId: 'msg-std-1',
              workspaceId: 'ws-123',
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      (handler as any).dispatchToAiRuntime = vi.fn().mockImplementation((payload: any) => {
        dispatchedReplyJid = payload.replyJid;
        return Promise.resolve();
      });

      const simulatedMsg: proto.IWebMessageInfo = {
        key: {
          remoteJid: '237654016097@s.whatsapp.net',
          id: 'WA-MSG-STD-1',
          fromMe: false,
        } as any,
        message: {
          conversation: 'Standard message',
        },
      };

      await handler.handleIncomingMessage('agent-123', simulatedMsg);

      expect(ingestedContactPhone).toBe('+237654016097');
      expect(dispatchedReplyJid).toBe('237654016097@s.whatsapp.net');
    });
  });

  // ------------------------------------------------------------------
  // 3. Inbound Dispatch Error Logging
  // ------------------------------------------------------------------
  describe('Inbound Dispatch Error Logging', () => {
    let handler: WhatsAppMessageHandler;
    let mockSupabase: any;

    beforeEach(() => {
      handler = new WhatsAppMessageHandler('http://localhost:4002');
      mockSupabase = {
        rpc: vi.fn(),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { workspace_id: 'ws-456' }, error: null }),
            }),
          }),
        }),
      };
      (handler as any).supabase = mockSupabase;
    });

    it('should log to public.execution_logs via worker_log_execution when AI Runtime returns non-200', async () => {
      let logPayload: any = null;

      mockSupabase.rpc.mockImplementation((rpcName: string, params: any) => {
        if (rpcName === 'worker_log_execution') {
          logPayload = params;
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await (handler as any).dispatchToAiRuntime(
        {
          agentId: 'agent-789',
          conversationId: 'conv-789',
          incomingMessage: 'Hello',
        },
        'ws-456'
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith('worker_log_execution', expect.any(Object));
      expect(logPayload).not.toBeNull();
      expect(logPayload.p_workspace_id).toBe('ws-456');
      expect(logPayload.p_agent_id).toBe('agent-789');
      expect(logPayload.p_level).toBe('error');
      expect(logPayload.p_event_type).toBe('ai_dispatch_failed');
      expect(logPayload.p_message).toContain('AI Runtime HTTP 500');
    });

    it('should log to public.execution_logs when fetch to AI Runtime throws a network error', async () => {
      let logPayload: any = null;

      mockSupabase.rpc.mockImplementation((rpcName: string, params: any) => {
        if (rpcName === 'worker_log_execution') {
          logPayload = params;
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      });

      global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED connect 127.0.0.1:4002'));

      await (handler as any).dispatchToAiRuntime(
        {
          agentId: 'agent-789',
          conversationId: 'conv-789',
          incomingMessage: 'Hello',
        },
        'ws-456'
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith('worker_log_execution', expect.any(Object));
      expect(logPayload).not.toBeNull();
      expect(logPayload.p_level).toBe('error');
      expect(logPayload.p_event_type).toBe('ai_dispatch_failed');
      expect(logPayload.p_message).toContain('ECONNREFUSED');
    });
  });

  // ------------------------------------------------------------------
  // 4. Session Restoration Phone Number Logic
  // ------------------------------------------------------------------
  describe('Session Restoration Phone Number', () => {
    it('should extract registered phone number from creds.me.id when restoring sessions', async () => {
      const manager = new WhatsAppSessionManager();
      const startSessionSpy = vi.spyOn(manager, 'startSession').mockResolvedValue({ status: 'connected' });

      // Mock fs.readdir and fs.readFile
      const testAgentId = 'test-agent-session-1';
      const fakeSessionDir = path.join(process.cwd(), 'tmp-sessions');
      (manager as any).baseSessionDir = fakeSessionDir;

      vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined as any);
      vi.spyOn(fs, 'readdir').mockResolvedValue([
        { name: testAgentId, isDirectory: () => true },
      ] as any);

      const fakeCreds = {
        registered: true,
        me: {
          id: '237695923604:1@s.whatsapp.net',
          name: 'Innoica Bot',
        },
      };
      vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify(fakeCreds));

      await manager.restoreAllSessions();

      expect(startSessionSpy).toHaveBeenCalledWith(
        testAgentId,
        '+237695923604',
        { isReconnect: true }
      );
    });
  });

  // ------------------------------------------------------------------
  // 5. End-to-End Inbound to AI Runtime & Outbound Dispatch Simulation
  // ------------------------------------------------------------------
  describe('End-to-End Inbound to AI Runtime Pipeline Simulation', () => {
    it('simulates incoming message -> AI Runtime -> outbound dispatch without drops', async () => {
      // 1. WhatsApp Worker mock
      let sentOutboundMessage: any = null;
      const sessionManagerMock = {
        sendMessage: vi.fn().mockImplementation(async (agentId: string, toPhone: string, text: string) => {
          sentOutboundMessage = { agentId, toPhone, text };
          return { messageId: '3EB0_VERIFIED_OUTBOUND_TEST' };
        }),
      } as unknown as WhatsAppSessionManager;

      const workerApp = createWorkerServer(sessionManagerMock);
      const workerResponse = await workerApp.inject({
        method: 'POST',
        url: '/api/sessions/3d27295b-f325-427c-aedf-a67493c19a75/send',
        payload: {
          toPhone: '+237654016097',
          text: 'Réponse générée par le test automatisé.',
        },
      });

      expect(workerResponse.statusCode).toBe(200);
      const workerBody = JSON.parse(workerResponse.body);
      expect(workerBody.success).toBe(true);
      expect(workerBody.messageId).toBe('3EB0_VERIFIED_OUTBOUND_TEST');
      expect(sentOutboundMessage).toEqual({
        agentId: '3d27295b-f325-427c-aedf-a67493c19a75',
        toPhone: '+237654016097',
        text: 'Réponse générée par le test automatisé.',
      });

      // 2. AI Runtime mock orchestrator responding to incoming message
      const orchestratorMock = {
        generateAndSendResponse: vi.fn().mockResolvedValue({
          success: true,
          reply: 'Bonjour, que puis-je faire pour vous ?',
          messageId: '3EB0_SIMULATED_AI_REPLY',
        }),
      } as unknown as AIOrchestrator;

      const aiApp = createAIRuntimeServer(orchestratorMock);
      const aiResponse = await aiApp.inject({
        method: 'POST',
        url: '/api/generate-response',
        payload: {
          agentId: '3d27295b-f325-427c-aedf-a67493c19a75',
          conversationId: '10afce22-1ff6-4ce2-b924-4d00de3368e5',
          contactPhoneNumber: '+237654016097',
          incomingMessage: 'Test message simulation',
        },
      });

      expect(aiResponse.statusCode).toBe(200);
      const aiBody = JSON.parse(aiResponse.body);
      expect(aiBody.success).toBe(true);
      expect(aiBody.reply).toBe('Bonjour, que puis-je faire pour vous ?');
      expect(aiBody.messageId).toBe('3EB0_SIMULATED_AI_REPLY');
    });
  });
});

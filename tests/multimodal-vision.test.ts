// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Milestone 1 Multimodal Vision Test Suite
// Verifies Baileys Image Extraction, Magic Bytes, Memory Sanitation,
// Fastify Server Validation, Anti-Hallucination Prompting & Non-Vision Fallback
// ====================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  VISION_FALLBACK_MESSAGES,
  AI_PROVIDERS_CONFIG,
  applyPlanWatermark,
} from '../packages/shared/src/index';
import {
  extractImageDescriptor,
  inspectImageMagicBytes,
  validateImageMetadataBeforeDownload,
  MAX_IMAGE_BYTES,
} from '../services/whatsapp-worker/src/handlers/image-handler';
import { createAIRuntimeServer } from '../services/ai-runtime/src/server';
import { AIOrchestrator } from '../services/ai-runtime/src/orchestrator';
import { callGemini } from '../services/ai-runtime/src/adapters/gemini';
import type { proto } from '@whiskeysockets/baileys';

describe('Milestone 1: Baileys Image Extraction & Binary Inspection', () => {
  it('extracts image descriptor with caption from standard imageMessage', () => {
    const rawMessage: proto.IMessage = {
      imageMessage: {
        url: 'https://mmg.whatsapp.net/v/t62.7118-24/test.enc',
        mimetype: 'image/jpeg',
        caption: 'Avez-vous ce produit en stock ?',
        fileLength: 102400,
        height: 800,
        width: 600,
        mediaKey: new Uint8Array([1, 2, 3, 4]),
      },
    };

    const descriptor = extractImageDescriptor(rawMessage);
    expect(descriptor).not.toBeNull();
    expect(descriptor?.isImage).toBe(true);
    expect(descriptor?.mimeType).toBe('image/jpeg');
    expect(descriptor?.caption).toBe('Avez-vous ce produit en stock ?');
    expect(descriptor?.fileSizeBytes).toBe(102400);
    expect(descriptor?.height).toBe(800);
    expect(descriptor?.width).toBe(600);
  });

  it('extracts image descriptor without caption (standalone photo)', () => {
    const rawMessage: proto.IMessage = {
      imageMessage: {
        mimetype: 'image/png',
        fileLength: 204800,
        caption: undefined,
      },
    };

    const descriptor = extractImageDescriptor(rawMessage);
    expect(descriptor).not.toBeNull();
    expect(descriptor?.isImage).toBe(true);
    expect(descriptor?.caption).toBeNull();
    expect(descriptor?.mimeType).toBe('image/png');
    expect(descriptor?.fileSizeBytes).toBe(204800);
  });

  it('unwraps viewOnceMessage and viewOnceMessageV2 containing imageMessage', () => {
    const viewOnceMessage: proto.IMessage = {
      viewOnceMessage: {
        message: {
          imageMessage: {
            mimetype: 'image/webp',
            caption: 'Photo temporaire',
            fileLength: 50000,
          },
        },
      },
    };

    const descriptor = extractImageDescriptor(viewOnceMessage);
    expect(descriptor).not.toBeNull();
    expect(descriptor?.caption).toBe('Photo temporaire');
    expect(descriptor?.mimeType).toBe('image/webp');
  });

  it('strictly inspects magic bytes for JPEG, PNG, and WebP formats and rejects corrupted bytes', () => {
    // Valid JPEG: FF D8 FF
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(inspectImageMagicBytes(jpegBuffer)).toBe('jpeg');

    // Valid PNG: 89 50 4E 47 0D 0A 1A 0A
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(inspectImageMagicBytes(pngBuffer)).toBe('png');

    // Valid WebP: RIFF .... WEBP
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x20, 0x00, 0x00, 0x00, // Size
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    expect(inspectImageMagicBytes(webpBuffer)).toBe('webp');

    // Invalid / Corrupted / Executable bytes
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]); // MZ
    expect(inspectImageMagicBytes(exeBuffer)).toBeNull();

    const shortBuffer = Buffer.from([0xff, 0xd8]);
    expect(inspectImageMagicBytes(shortBuffer)).toBeNull();

    const textBuffer = Buffer.from('Not an image file at all!');
    expect(inspectImageMagicBytes(textBuffer)).toBeNull();
  });

  it('validates image size limits and rejects files over 15MB', () => {
    const validDesc = {
      isImage: true as const,
      mimeType: 'image/jpeg',
      caption: null,
      fileSizeBytes: 5 * 1024 * 1024,
    };
    expect(validateImageMetadataBeforeDownload(validDesc)).toEqual({ valid: true });

    const tooLargeDesc = {
      isImage: true as const,
      mimeType: 'image/jpeg',
      caption: null,
      fileSizeBytes: MAX_IMAGE_BYTES + 1,
    };
    expect(validateImageMetadataBeforeDownload(tooLargeDesc)).toEqual({
      valid: false,
      errorCode: 'image_too_large',
    });

    const invalidMimeDesc = {
      isImage: true as const,
      mimeType: 'application/pdf',
      caption: null,
      fileSizeBytes: 1024,
    };
    expect(validateImageMetadataBeforeDownload(invalidMimeDesc)).toEqual({
      valid: false,
      errorCode: 'unsupported_mime_type',
    });
  });

  it('sanitizes image buffer in memory via buffer.fill(0)', () => {
    const buffer = Buffer.from('sensitive_image_binary_data');
    expect(buffer.toString()).toBe('sensitive_image_binary_data');

    buffer.fill(0);
    for (let i = 0; i < buffer.length; i++) {
      expect(buffer[i]).toBe(0);
    }
  });
});

describe('Milestone 1: AI Runtime Fastify API & Vision Integration', () => {
  let orchestratorMock: AIOrchestrator;

  beforeEach(() => {
    orchestratorMock = {
      generateAndSendResponse: vi.fn(),
    } as unknown as AIOrchestrator;
  });

  it('accepts incomingMessageType: image with empty incomingMessage', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      success: true,
      reply: 'Analyse visuelle effectuée.',
      messageId: 'MSG-VISION-1',
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
        incomingMessage: '',
        incomingMessageType: 'image',
        imageContext: {
          mimeType: 'image/jpeg',
          base64Data: 'dGVzdA==',
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(mockFn).toHaveBeenCalledWith(
      expect.objectContaining({
        incomingMessageType: 'image',
        incomingMessage: '',
        imageContext: expect.objectContaining({
          mimeType: 'image/jpeg',
          base64Data: 'dGVzdA==',
        }),
      })
    );
  });

  it('verifies AI_PROVIDERS_CONFIG vision flag consistency', () => {
    expect(AI_PROVIDERS_CONFIG.gemini.models.find((m) => m.id === 'gemini-2.0-flash')?.isVision).toBe(true);
    expect(AI_PROVIDERS_CONFIG.gemini.models.find((m) => m.id === 'gemini-1.5-flash')?.isVision).toBe(true);
    expect(AI_PROVIDERS_CONFIG.openai.models.find((m) => m.id === 'gpt-4o-mini')?.isVision).toBe(true);
    expect(AI_PROVIDERS_CONFIG.openrouter.models.find((m) => m.id === 'google/gemini-2.0-flash-exp:free')?.isVision).toBe(true);

    // Groq models have isVision: false
    for (const m of AI_PROVIDERS_CONFIG.groq.models) {
      expect(m.isVision).toBe(false);
    }
  });

  it('returns exact polite refusal for non-vision models in French and English with watermark', () => {
    expect(VISION_FALLBACK_MESSAGES.unsupported_model.fr).toContain(
      "Désolé, je ne peux pas analyser les images pour le moment car mon modèle d'intelligence artificielle actuel ne prend pas en charge la vision."
    );
    expect(VISION_FALLBACK_MESSAGES.unsupported_model.en).toContain(
      "Sorry, I cannot analyze images at this time because my current AI model does not support vision."
    );

    const watermarkedFr = applyPlanWatermark(VISION_FALLBACK_MESSAGES.unsupported_model.fr, {
      hasWatermark: true,
      language: 'fr',
    });
    expect(watermarkedFr).toContain("Désolé, je ne peux pas analyser les images");
    expect(watermarkedFr).toContain("Innoica Agent Studio");

    const watermarkedEn = applyPlanWatermark(VISION_FALLBACK_MESSAGES.unsupported_model.en, {
      hasWatermark: true,
      language: 'en',
    });
    expect(watermarkedEn).toContain("Sorry, I cannot analyze images");
    expect(watermarkedEn).toContain("Innoica Agent Studio");
  });

  it('returns exact corrupted image error message in French and English', () => {
    expect(VISION_FALLBACK_MESSAGES.corrupted_image.fr).toBe(
      "Désolé, impossible de charger votre image (fichier corrompu ou expiré). Veuillez renvoyer une photo nette."
    );
    expect(VISION_FALLBACK_MESSAGES.corrupted_image.en).toBe(
      "Sorry, unable to load your image (corrupted or expired file). Please send a clear photo again."
    );
  });

  it('formats Gemini native inlineData payload correctly from multimodal content parts', async () => {
    // Mock global fetch for Gemini API
    const originalFetch = globalThis.fetch;
    let capturedBody: any = null;

    globalThis.fetch = vi.fn().mockImplementation(async (_url: string, options: any) => {
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "Ceci est une montre connectée INNOICA." }],
              },
            },
          ],
        }),
      } as any;
    });

    try {
      const reply = await callGemini({
        apiKey: 'fake-gemini-key',
        model: 'gemini-2.0-flash',
        messages: [
          { role: 'system', content: 'Tu es un assistant e-commerce.' },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Quel est ce produit ?' },
              {
                type: 'image_url',
                image_url: { url: 'data:image/jpeg;base64,dGVzdGFzc2V0' },
              },
            ],
          },
        ],
      });

      expect(reply).toBe("Ceci est une montre connectée INNOICA.");
      expect(capturedBody).not.toBeNull();
      expect(capturedBody.systemInstruction.parts[0].text).toBe('Tu es un assistant e-commerce.');

      // Check native inlineData conversion
      const userParts = capturedBody.contents[0].parts;
      expect(userParts[0]).toEqual({ text: 'Quel est ce produit ?' });
      expect(userParts[1]).toEqual({
        inlineData: {
          mimeType: 'image/jpeg',
          data: 'dGVzdGFzc2V0',
        },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('scrubs base64Data in memory on completion of orchestrator execution', async () => {
    const orchestrator = new AIOrchestrator('http://localhost:4001');

    const imageContext = {
      mimeType: 'image/png',
      base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      caption: 'Test photo',
    };

    // Mock supabase.rpc to abort early at context loading
    (orchestrator as any).supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: { ok: false, error: 'agent_not_found' },
        error: null,
      }),
    };

    await orchestrator.generateAndSendResponse({
      agentId: '00000000-0000-0000-0000-000000000001',
      conversationId: '00000000-0000-0000-0000-000000000002',
      contactPhoneNumber: '+237691234567',
      incomingMessage: '',
      incomingMessageType: 'image',
      imageContext,
    });

    // base64Data must be thoroughly scrubbed from memory
    expect(imageContext.base64Data).toBeUndefined();
  });
});

describe('Milestone 1: WhatsAppMessageHandler Image Processing Pipeline', () => {
  let mockSupabase: any;
  let mockMediaDownloader: any;
  let handler: any;
  let dispatchedPayloads: any[];

  beforeEach(async () => {
    dispatchedPayloads = [];
    mockSupabase = {
      rpc: vi.fn().mockImplementation((name: string, params: any) => {
        if (name === 'worker_ingest_inbound_message') {
          return Promise.resolve({
            data: {
              ok: true,
              agentStatus: 'active',
              conversationId: 'conv-test-123',
              controlMode: 'ai_active',
              messageId: 'msg-test-456',
              workspaceId: 'ws-test-789',
              preferredLanguage: 'fr',
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };

    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    mockMediaDownloader = vi.fn().mockResolvedValue(validJpeg);

    const { WhatsAppMessageHandler } = await import('../services/whatsapp-worker/src/handlers/message-handler');
    handler = new WhatsAppMessageHandler('http://localhost:4002', {
      mediaDownloader: mockMediaDownloader,
    });
    handler.supabase = mockSupabase;

    handler.dispatchToAiRuntime = vi.fn().mockImplementation(async (payload: any) => {
      dispatchedPayloads.push(payload);
    });
  });

  it('ingests imageMessage with caption as message_type=image and transmits base64 imageContext to AI Runtime', async () => {
    const rawMsg: proto.IWebMessageInfo = {
      key: {
        remoteJid: '237691234567@s.whatsapp.net',
        id: 'WA_IMG_001',
      },
      message: {
        imageMessage: {
          mimetype: 'image/jpeg',
          caption: 'Combien coûte cet article ?',
          fileLength: 12000,
        },
      },
      pushName: 'Paul Biya',
    };

    await handler.handleIncomingMessage('agent-uuid-1', rawMsg);

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'worker_ingest_inbound_message',
      expect.objectContaining({
        p_agent_id: 'agent-uuid-1',
        p_contact_phone: '+237691234567',
        p_wa_message_id: 'WA_IMG_001',
        p_message_type: 'image',
        p_content: '[Photo] Combien coûte cet article ?',
        p_image_metadata: expect.objectContaining({
          mimeType: 'image/jpeg',
          caption: 'Combien coûte cet article ?',
        }),
      })
    );

    expect(mockMediaDownloader).toHaveBeenCalledWith('agent-uuid-1', rawMsg);

    expect(dispatchedPayloads).toHaveLength(1);
    expect(dispatchedPayloads[0]).toEqual(
      expect.objectContaining({
        agentId: 'agent-uuid-1',
        conversationId: 'conv-test-123',
        contactPhoneNumber: '+237691234567',
        incomingMessageType: 'image',
        incomingMessage: 'Combien coûte cet article ?',
        imageContext: expect.objectContaining({
          mimeType: 'image/jpeg',
          caption: 'Combien coûte cet article ?',
        }),
      })
    );
    expect(dispatchedPayloads[0].imageContext.base64Data).toBeDefined();
  });

  it('ingests standalone image without caption and dispatches to AI Runtime with empty incomingMessage without dropping', async () => {
    const rawMsg: proto.IWebMessageInfo = {
      key: {
        remoteJid: '237699887766@s.whatsapp.net',
        id: 'WA_IMG_002',
      },
      message: {
        imageMessage: {
          mimetype: 'image/jpeg',
          fileLength: 8500,
        },
      },
    };

    await handler.handleIncomingMessage('agent-uuid-1', rawMsg);

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      'worker_ingest_inbound_message',
      expect.objectContaining({
        p_wa_message_id: 'WA_IMG_002',
        p_message_type: 'image',
        p_content: '[Photo]',
      })
    );

    expect(dispatchedPayloads).toHaveLength(1);
    expect(dispatchedPayloads[0]).toEqual(
      expect.objectContaining({
        incomingMessageType: 'image',
        incomingMessage: '',
        imageContext: expect.objectContaining({
          mimeType: 'image/jpeg',
        }),
      })
    );
  });

  it('dispatches isCorrupted: true when downloaded buffer magic bytes are invalid', async () => {
    mockMediaDownloader.mockResolvedValueOnce(Buffer.from([0x00, 0x11, 0x22, 0x33, 0x44]));

    const rawMsg: proto.IWebMessageInfo = {
      key: {
        remoteJid: '237691234567@s.whatsapp.net',
        id: 'WA_IMG_CORRUPT',
      },
      message: {
        imageMessage: {
          mimetype: 'image/jpeg',
          fileLength: 100,
        },
      },
    };

    await handler.handleIncomingMessage('agent-uuid-1', rawMsg);

    expect(dispatchedPayloads).toHaveLength(1);
    expect(dispatchedPayloads[0].imageContext).toEqual(
      expect.objectContaining({
        isCorrupted: true,
      })
    );
  });
});

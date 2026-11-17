// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Google Gemini Adapter
// ====================================================================

import { LLMGenerateOptions } from './openrouter.js';

export async function callGemini(options: LLMGenerateOptions): Promise<string> {
  const { apiKey, model, temperature = 0.7, messages, maxTokens = 1000 } = options;

  // Séparer les messages système des messages de conversation pour Gemini
  const systemMessage = messages.find((m) => m.role === 'system');
  const chatMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      let parts: any[] = [];
      if (typeof m.content === 'string') {
        parts = [{ text: m.content }];
      } else if (Array.isArray(m.content)) {
        parts = m.content.map((part) => {
          if (part.type === 'text') {
            return { text: part.text };
          }
          if (part.type === 'image_url') {
            const url = part.image_url.url;
            const match = /^data:([^;]+);base64,(.+)$/.exec(url);
            if (match) {
              return {
                inlineData: {
                  mimeType: match[1],
                  data: match[2],
                },
              };
            }
          }
          return { text: '' };
        });
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts,
      };
    });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload: any = {
    contents: chatMessages,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  if (systemMessage) {
    const systemText =
      typeof systemMessage.content === 'string'
        ? systemMessage.content
        : systemMessage.content
            .filter((p) => p.type === 'text')
            .map((p) => (p as { type: 'text'; text: string }).text)
            .join('\n');
    payload.systemInstruction = {
      parts: [{ text: systemText }],
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 400 || res.status === 403) {
      throw new Error(`Google Gemini: Clé API invalide ou non autorisée (${res.status})`);
    } else if (res.status === 429) {
      throw new Error(`Google Gemini: Quota de requêtes dépassé (${res.status})`);
    }
    throw new Error(`Google Gemini Erreur (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) {
    throw new Error('Google Gemini: Aucune réponse retournée par le modèle');
  }

  return reply.trim();
}

export async function testGeminiKey(apiKey: string): Promise<{ isValid: boolean; error?: string }> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      return { isValid: false, error: `Clé Gemini invalide (${res.status})` };
    }
    return { isValid: true };
  } catch (err: any) {
    return { isValid: false, error: err.message };
  }
}

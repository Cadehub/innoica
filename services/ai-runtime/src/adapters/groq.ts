// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Groq Adapter
// ====================================================================

import { LLMGenerateOptions } from './openrouter.js';

export async function callGroq(options: LLMGenerateOptions): Promise<string> {
  const { apiKey, model, temperature = 0.7, messages, maxTokens = 3072 } = options;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages,
      max_tokens: maxTokens,
      reasoning_format: 'hidden',
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 401) {
      throw new Error(`Groq: Clé API invalide (${res.status})`);
    } else if (res.status === 429) {
      throw new Error(`Groq: Limite de débit atteinte (${res.status})`);
    }
    throw new Error(`Groq Erreur (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const message = choice?.message;
  let reply = message?.content;

  if (!reply || !reply.trim()) {
    if (message?.reasoning && typeof message.reasoning === 'string' && message.reasoning.trim()) {
      reply = message.reasoning.trim();
    } else {
      throw new Error('Groq: Aucune réponse retournée par le modèle');
    }
  }

  return reply.trim();
}

export async function testGroqKey(apiKey: string): Promise<{ isValid: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) {
      return { isValid: false, error: `Erreur d'authentification Groq (${res.status})` };
    }
    return { isValid: true };
  } catch (err: any) {
    return { isValid: false, error: err.message };
  }
}

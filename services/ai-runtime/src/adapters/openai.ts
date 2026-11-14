// ====================================================================
// INNOICA WhatsApp Agents v2.0 — OpenAI Adapter
// ====================================================================

import { LLMGenerateOptions } from './openrouter.js';

export async function callOpenAI(options: LLMGenerateOptions): Promise<string> {
  const { apiKey, model, temperature = 0.7, messages, maxTokens = 1000 } = options;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 401) {
      throw new Error(`OpenAI: Clé API invalide (${res.status})`);
    } else if (res.status === 429) {
      throw new Error(`OpenAI: Quota ou limite de débit atteint (${res.status})`);
    }
    throw new Error(`OpenAI Erreur (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error('OpenAI: Aucune réponse retournée par le modèle');
  }

  return reply.trim();
}

export async function testOpenAIKey(apiKey: string): Promise<{ isValid: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) {
      return { isValid: false, error: `Clé OpenAI invalide (${res.status})` };
    }
    return { isValid: true };
  } catch (err: any) {
    return { isValid: false, error: err.message };
  }
}

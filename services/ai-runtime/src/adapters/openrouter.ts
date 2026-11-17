// ====================================================================
// INNOICA WhatsApp Agents v2.0 — OpenRouter Adapter
// ====================================================================

export type LLMContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | LLMContentPart[];
}

export interface LLMGenerateOptions {
  apiKey: string;
  model: string;
  temperature?: number;
  messages: LLMMessage[];
  maxTokens?: number;
}

export async function callOpenRouter(options: LLMGenerateOptions): Promise<string> {
  const { apiKey, model, temperature = 0.7, messages, maxTokens = 1000 } = options;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://agents.innoica.com',
      'X-Title': 'INNOICA WhatsApp Agents',
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
      throw new Error(`OpenRouter: Clé API invalide (${res.status})`);
    } else if (res.status === 402 || res.status === 429) {
      throw new Error(`OpenRouter: Crédit insuffisant ou quota dépassé (${res.status})`);
    }
    throw new Error(`OpenRouter Erreur (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error('OpenRouter: Aucune réponse retournée par le modèle');
  }

  return reply.trim();
}

export async function testOpenRouterKey(apiKey: string): Promise<{ isValid: boolean; error?: string }> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!res.ok) {
      return { isValid: false, error: `Erreur d'authentification OpenRouter (${res.status})` };
    }
    return { isValid: true };
  } catch (err: any) {
    return { isValid: false, error: err.message };
  }
}

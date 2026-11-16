// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Live AI Provider Validator
// ====================================================================

export interface ProviderValidationResult {
  isValid: boolean;
  message: string;
  details?: {
    modelCount?: number;
    accountInfo?: string;
    suggestedModels?: string[];
  };
}

/**
 * Valide en temps réel une clé API auprès du fournisseur officiel
 */
export async function validateProviderApiKey(
  provider: 'openrouter' | 'groq' | 'gemini' | 'openai',
  apiKey: string
): Promise<ProviderValidationResult> {
  const cleanKey = apiKey.trim();

  if (!cleanKey) {
    return { isValid: false, message: 'La clé API est vide.' };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

  try {
    switch (provider) {
      case 'openrouter': {
        // Validation officielle OpenRouter auth key
        const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://agents.innoica.com',
            'X-Title': 'Innoica Agent Studio',
          },
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json();
          const label = data.data?.label || 'Clé OpenRouter active';
          const limit = data.data?.limit != null ? `${data.data.limit} USD` : 'Illimité';
          return {
            isValid: true,
            message: `Connexion OpenRouter réussie (${label}, Limite: ${limit})`,
            details: {
              accountInfo: label,
              suggestedModels: [
                'google/gemini-2.0-flash-exp:free',
                'meta-llama/llama-3.2-11b-vision-instruct:free',
                'meta-llama/llama-3.3-70b-instruct:free',
                'qwen/qwen-2.5-vl-72b-instruct:free',
              ],
            },
          };
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error?.message || `Erreur OpenRouter HTTP ${res.status}`;
          return { isValid: false, message: `Clé OpenRouter refusée : ${errMsg}` };
        }
      }

      case 'groq': {
        // Validation officielle Groq OpenAI-compatible
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
          },
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json();
          const count = Array.isArray(data.data) ? data.data.length : 0;
          return {
            isValid: true,
            message: `Connexion Groq ultra-rapide validée (${count} modèles accessibles)`,
            details: {
              modelCount: count,
              suggestedModels: [
                'openai/gpt-oss-120b',
                'qwen/qwen3.8-27b',
                'openai/gpt-oss-20b',
              ],
            },
          };
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error?.message || `Erreur Groq HTTP ${res.status}`;
          return { isValid: false, message: `Clé Groq invalide : ${errMsg}` };
        }
      }

      case 'gemini': {
        // Validation officielle Google Gemini
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`,
          {
            method: 'GET',
            signal: controller.signal,
          }
        );

        if (res.ok) {
          const data = await res.json();
          const count = Array.isArray(data.models) ? data.models.length : 0;
          return {
            isValid: true,
            message: `Connexion Google Gemini validée avec succès (${count} modèles)`,
            details: {
              modelCount: count,
              suggestedModels: ['gemini-2.0-flash', 'gemini-1.5-flash'],
            },
          };
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error?.message || `Erreur Google AI HTTP ${res.status}`;
          return { isValid: false, message: `Clé Google Gemini invalide : ${errMsg}` };
        }
      }

      case 'openai': {
        // Validation officielle OpenAI
        const res = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
          },
          signal: controller.signal,
        });

        if (res.ok) {
          const data = await res.json();
          const count = Array.isArray(data.data) ? data.data.length : 0;
          return {
            isValid: true,
            message: `Connexion OpenAI validée avec succès (${count} modèles disponibles)`,
            details: {
              modelCount: count,
              suggestedModels: ['gpt-4o-mini', 'gpt-4o'],
            },
          };
        } else {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error?.message || `Erreur OpenAI HTTP ${res.status}`;
          return { isValid: false, message: `Clé OpenAI invalide : ${errMsg}` };
        }
      }

      default:
        return { isValid: false, message: 'Fournisseur non supporté.' };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { isValid: false, message: 'Délai d\'attente dépassé (timeout 8s) vers l\'API du fournisseur.' };
    }
    return { isValid: false, message: `Erreur de connexion réseau : ${error.message}` };
  } finally {
    clearTimeout(timeoutId);
  }
}

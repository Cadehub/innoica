// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Multi-Provider BYOK Router
// ====================================================================

import { callOpenRouter, testOpenRouterKey, LLMGenerateOptions } from './openrouter.js';
import { callGroq, testGroqKey } from './groq.js';
import { callGemini, testGeminiKey } from './gemini.js';
import { callOpenAI, testOpenAIKey } from './openai.js';
import { AIProvider } from '@innoica/shared';

export * from './openrouter.js';
export * from './groq.js';
export * from './gemini.js';
export * from './openai.js';

export async function dispatchLLMCall(
  provider: AIProvider,
  options: LLMGenerateOptions
): Promise<string> {
  switch (provider) {
    case 'openrouter':
      return callOpenRouter(options);
    case 'groq':
      return callGroq(options);
    case 'gemini':
      return callGemini(options);
    case 'openai':
      return callOpenAI(options);
    default:
      throw new Error(`Fournisseur IA non supporté: ${provider}`);
  }
}

export async function testProviderKey(
  provider: AIProvider,
  apiKey: string
): Promise<{ isValid: boolean; error?: string }> {
  switch (provider) {
    case 'openrouter':
      return testOpenRouterKey(apiKey);
    case 'groq':
      return testGroqKey(apiKey);
    case 'gemini':
      return testGeminiKey(apiKey);
    case 'openai':
      return testOpenAIKey(apiKey);
    default:
      return { isValid: false, error: `Fournisseur inconnu : ${provider}` };
  }
}

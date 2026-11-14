// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Constants & Platform Configuration
// ====================================================================

export const APP_CONFIG = {
  name: 'INNOICA WhatsApp Agents',
  slogan: 'Turn Complexity Into Simplicity',
  version: '2.0.0',
  defaultLocale: 'fr',
  locales: ['fr', 'en'] as const,
  currency: 'XAF',
  currencySymbol: 'FCFA',
  timezone: 'Africa/Douala',
  limits: {
    maxPdfSizeBytes: 10 * 1024 * 1024, // 10 MB
    maxTxtSizeBytes: 5 * 1024 * 1024,  // 5 MB
    maxWebScrapeSizeBytes: 5 * 1024 * 1024, // 5 MB
    webScrapeTimeoutMs: 10000, // 10s
    pairingCodeExpiryMinutes: 10,
    maxPairingAttemptsPerWindow: 3,
    pairingAttemptWindowMinutes: 10,
  },
} as const;

export const AI_PROVIDERS_CONFIG = {
  openrouter: {
    name: 'OpenRouter',
    models: [
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct (Recommandé)', context: 128000 },
      { id: 'mistralai/mistral-large-2411', name: 'Mistral Large 2411', context: 128000 },
      { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', context: 64000 },
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', context: 200000 },
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', context: 1000000 },
    ],
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
  },
  groq: {
    name: 'Groq (Vitesse Ultra-Rapide)',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Recommandé)', context: 128000 },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', context: 128000 },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', context: 32768 },
    ],
    defaultModel: 'llama-3.3-70b-versatile',
  },
  gemini: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Recommandé)', context: 1000000 },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', context: 2000000 },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', context: 1000000 },
    ],
    defaultModel: 'gemini-1.5-flash',
  },
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Recommandé)', context: 128000 },
      { id: 'gpt-4o', name: 'GPT-4o', context: 128000 },
    ],
    defaultModel: 'gpt-4o-mini',
  },
} as const;

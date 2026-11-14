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

export const AGENT_TEMPLATES = [
  {
    id: 'receptionist',
    name: 'Receptionist Agent',
    description: 'Accueille les nouveaux contacts, présente l’entreprise, répond aux FAQ, horaires et tarifs, et transfère aux humains.',
    category: 'Accueil & Support',
    defaultPrompt: 'Tu es l’agent d’accueil officiel de notre entreprise sur WhatsApp. Ton rôle est d’accueillir chaleureusement les contacts, présenter nos services et répondre à leurs questions.',
  },
  {
    id: 'sales',
    name: 'Sales Agent',
    description: 'Présente le catalogue de produits/services, qualifie les prospects et transmet les opportunités commerciales.',
    category: 'Commercial',
    defaultPrompt: 'Tu es l’agent commercial de notre entreprise sur WhatsApp. Ton rôle est de conseiller nos prospects, présenter nos offres et collecter leurs besoins d’achat.',
  },
  {
    id: 'support',
    name: 'Support Agent',
    description: 'Assistance client de niveau 1, diagnostic rapide, résolution guidée par la base de connaissances et escalade.',
    category: 'Support Technique',
    defaultPrompt: 'Tu es l’agent de support technique sur WhatsApp. Ton rôle est d’aider nos clients à résoudre leurs difficultés en t’appuyant scrupuleusement sur notre documentation.',
  },
  {
    id: 'booking',
    name: 'Booking Agent',
    description: 'Collecte les demandes de rendez-vous, recueille les dates et préférences sans inventer de disponibilités.',
    category: 'Réservation',
    defaultPrompt: 'Tu es l’agent de prise de rendez-vous sur WhatsApp. Ton rôle est de collecter les demandes de disponibilité, dates et créneaux souhaités, sans jamais inventer de confirmation ferme sans validation humaine.',
  },
  {
    id: 'restaurant',
    name: 'Restaurant Agent',
    description: 'Présente le menu du restaurant, répond aux questions d’ingrédients/allergies, et prend les commandes.',
    category: 'Restauration',
    defaultPrompt: 'Tu es l’agent d’accueil et de prise de commande de notre restaurant sur WhatsApp. Présente notre carte et note les commandes avec précision.',
  },
  {
    id: 'custom',
    name: 'Custom Agent',
    description: 'Agent libre entièrement personnalisable pour des scénarios métiers spécifiques.',
    category: 'Personnalisé',
    defaultPrompt: 'Tu es un assistant IA professionnel connecté sur WhatsApp.',
  },
] as const;

export type AgentTemplateId = (typeof AGENT_TEMPLATES)[number]['id'];

export const SUBSCRIPTION_PLANS = {
  starter: {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 15000,
    priceYearly: 150000,
    currency: 'XAF',
    maxAgents: 1,
    maxKnowledgeSources: 3,
    maxMessagesPerMonth: 2000,
    features: ['1 Agent WhatsApp', 'Pairing Code Baileys', 'BYOK IA', 'Support Standard'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceMonthly: 35000,
    priceYearly: 350000,
    currency: 'XAF',
    maxAgents: 3,
    maxKnowledgeSources: 10,
    maxMessagesPerMonth: 10000,
    features: ['3 Agents WhatsApp', 'Multi-modèles BYOK', 'Mémoire Durable', 'Prise en main humaine directe', 'Support Prioritaire'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 90000,
    priceYearly: 900000,
    currency: 'XAF',
    maxAgents: 10,
    maxKnowledgeSources: 50,
    maxMessagesPerMonth: 50000,
    features: ['10 Agents WhatsApp', 'BYOK Illimité', 'RAG Haute Vitesse', 'Super Admin & Multi-Workspaces', 'Support Dédié 24/7'],
  },
} as const;

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
  gemini: {
    name: 'Google Gemini',
    tagline: 'Gratuit & Vision Multimodale Native',
    freeNotice: 'Quota gratuit généreux sans carte de crédit requis sur Google AI Studio',
    models: [
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash (Gratuit + Vision)',
        isVision: true,
        isFree: true,
        context: 1000000,
        badge: 'Vision + Gratuit',
        description: 'Dernière génération multimodale de Google. Analyse instantanément textes, documents et photos WhatsApp.',
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash (Gratuit + Vision)',
        isVision: true,
        isFree: true,
        context: 1000000,
        badge: 'Vision + Contexte 1M',
        description: 'Recommandé pour les longs documents et l’analyse visuelle bilingue FR/EN.',
      },
    ],
    defaultModel: 'gemini-2.0-flash',
  },
  groq: {
    name: 'Groq Cloud',
    tagline: 'Vitesse Éclair & Vision LPU Gratuite',
    freeNotice: 'Inclus dans le forfait développeur gratuit de console.groq.com',
    models: [
      {
        id: 'llama-3.2-11b-vision-preview',
        name: 'Llama 3.2 11B Vision (Gratuit + Vision)',
        isVision: true,
        isFree: true,
        context: 128000,
        badge: 'Vision + Ultra-Rapide',
        description: 'Compréhension d’images à ultra-haute vitesse (< 400ms). Idéal pour WhatsApp.',
      },
      {
        id: 'llama-3.2-90b-vision-preview',
        name: 'Llama 3.2 90B Vision (Gratuit + Vision Puissant)',
        isVision: true,
        isFree: true,
        context: 128000,
        badge: 'Vision 90B Haute Précision',
        description: 'Le modèle de vision Llama le plus performant pour analyser des factures, menus et reçus.',
      },
      {
        id: 'llama-3.3-70b-versatile',
        name: 'Llama 3.3 70B Versatile (Gratuit - Texte)',
        isVision: false,
        isFree: true,
        context: 128000,
        badge: 'Texte Élite 70B',
        description: 'Excellence linguistique en français et anglais pour des réponses conversationnelles parfaites.',
      },
    ],
    defaultModel: 'llama-3.2-11b-vision-preview',
  },
  openrouter: {
    name: 'OpenRouter',
    tagline: 'Sélection 100% Gratuite (:free)',
    freeNotice: 'Modèles officiellement gratuits (0.00$) sans frais sur openrouter.ai',
    models: [
      {
        id: 'google/gemini-2.0-flash-exp:free',
        name: 'Gemini 2.0 Flash Exp (Gratuit + Vision)',
        isVision: true,
        isFree: true,
        context: 1000000,
        badge: 'Vision 100% Gratuit',
        description: 'Modèle vision Google accessible à coût zéro via OpenRouter.',
      },
      {
        id: 'meta-llama/llama-3.2-11b-vision-instruct:free',
        name: 'Llama 3.2 11B Vision (Gratuit + Vision)',
        isVision: true,
        isFree: true,
        context: 128000,
        badge: 'Vision Open-Source',
        description: 'Reconnaissance d’images bilingue gratuite sans aucun crédit requis.',
      },
      {
        id: 'meta-llama/llama-3.3-70b-instruct:free',
        name: 'Llama 3.3 70B Instruct (Gratuit - Texte)',
        isVision: false,
        isFree: true,
        context: 128000,
        badge: 'Texte 70B Gratuit',
        description: 'Le modèle texte open-source le plus intelligent du monde, disponible gratuitement.',
      },
      {
        id: 'qwen/qwen-2.5-vl-72b-instruct:free',
        name: 'Qwen 2.5 VL 72B (Gratuit + Vision Expert)',
        isVision: true,
        isFree: true,
        context: 32000,
        badge: 'Top Vision Mondial',
        description: 'Leader mondial en lecture de documents visuels, menus, étiquettes et graphiques.',
      },
    ],
    defaultModel: 'google/gemini-2.0-flash-exp:free',
  },
  openai: {
    name: 'OpenAI',
    tagline: 'Standard GPT Multimodal Économique',
    freeNotice: 'Modèle multimodal le plus économique d’OpenAI (éligible crédits d’essai)',
    models: [
      {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini (Vision + Bilingue)',
        isVision: true,
        isFree: false,
        context: 128000,
        badge: 'Vision Multimodal',
        description: 'Combine haute intelligence textuelle et analyse visuelle précise d’OpenAI.',
      },
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

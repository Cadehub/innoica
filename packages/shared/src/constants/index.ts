// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Constants & Platform Configuration
// ====================================================================

export const APP_CONFIG = {
  name: 'Innoica Agent Studio',
  brand: 'INNOICA',
  slogan: 'Turn Complexity Into Simplicity',
  version: '2.1.0',
  defaultLocale: 'fr',
  locales: ['fr', 'en'] as const,
  currency: 'XAF',
  currencySymbol: 'FCFA',
  timezone: 'Africa/Douala',
  officialProductionUrl: 'https://agents.innoica.com',
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
    tagline: 'Vitesse Éclair LPU & Forfait Gratuit',
    freeNotice: 'Inclus dans le forfait développeur gratuit de console.groq.com',
    models: [
      {
        id: 'openai/gpt-oss-120b',
        name: 'GPT-OSS 120B (Gratuit - Raisonnement & Bilingue)',
        isVision: false,
        isFree: true,
        context: 131072,
        badge: 'Élite 120B Gratuit',
        description: 'Modèle principal haute performance sur Groq, idéal pour le français et l’anglais.',
      },
      {
        id: 'qwen/qwen3.8-27b',
        name: 'Qwen 3.8 27B (Gratuit - Rapide & Bilingue)',
        isVision: false,
        isFree: true,
        context: 131072,
        badge: 'Ultra-Rapide FR/EN',
        description: 'Excellente compréhension multilingue avec latence ultra-faible sur LPU Groq.',
      },
      {
        id: 'openai/gpt-oss-20b',
        name: 'GPT-OSS 20B (Gratuit - Instantané)',
        isVision: false,
        isFree: true,
        context: 131072,
        badge: 'Latence Minimale',
        description: 'Réponses quasi instantanées sur WhatsApp avec consommation minimale de quota.',
      },
    ],
    defaultModel: 'openai/gpt-oss-120b',
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

export const PLAN_CATALOG = {
  free: {
    id: 'free',
    slug: 'free',
    nameFr: 'Free',
    nameEn: 'Free',
    descriptionFr: 'Pour découvrir Innoica Agent Studio avec un agent WhatsApp et un quota journalier adapté.',
    descriptionEn: 'Start exploring Innoica Agent Studio with one WhatsApp agent and daily starter quotas.',
    priceMonthly: 0,
    priceYearly: 0,
    annualFullPrice: 0,
    annualSavings: 0,
    annualDiscountPercent: 0,
    currency: 'XAF',
    maxAgents: 1,
    maxConnections: 1,
    maxDailyNewConversations: 5 as number | null,
    maxDailyBotRepliesPerConv: 10 as number | null,
    maxKnowledgeDocs: 3,
    allowedKnowledgeTypes: ['faq', 'txt'] as const,
    historyRetentionDays: 7 as number | null,
    hasWatermark: true,
    capabilities: {
      voice_message_understanding: false,
    },
    featuresFr: [
      '1 Agent IA WhatsApp',
      '1 Numéro WhatsApp connecté',
      '5 nouvelles conversations / jour',
      '10 réponses IA / conversation / jour',
      'BYOK (OpenRouter, Groq, Gemini, OpenAI)',
      'Base de connaissances (FAQ & TXT)',
      'Historique conservé 7 jours',
      'Messages texte uniquement (vocaux réservés aux plans payants)',
      'Signature INNOICA sur les réponses IA',
    ],
    featuresEn: [
      '1 WhatsApp AI Agent',
      '1 Connected WhatsApp number',
      '5 new conversations / day',
      '10 AI replies / conversation / day',
      'BYOK (OpenRouter, Groq, Gemini, OpenAI)',
      'Knowledge base (FAQ & TXT)',
      '7-day conversation history',
      'Text messages only (voice messages require a paid plan)',
      'INNOICA signature on AI replies',
    ],
  },
  starter: {
    id: 'starter',
    slug: 'starter',
    nameFr: 'Starter',
    nameEn: 'Starter',
    descriptionFr: 'Idéal pour les entreprises et professionnels exigeant autonomie complète, mémoire durable et zéro signature.',
    descriptionEn: 'Built for businesses and professionals requiring full autonomy, durable memory, and no signature.',
    priceMonthly: 5000,
    priceYearly: 54000,
    annualFullPrice: 60000,
    annualSavings: 6000,
    annualDiscountPercent: 10,
    currency: 'XAF',
    maxAgents: 2,
    maxConnections: 2,
    maxDailyNewConversations: null as number | null,
    maxDailyBotRepliesPerConv: null as number | null,
    maxKnowledgeDocs: 25,
    allowedKnowledgeTypes: ['faq', 'txt', 'pdf', 'url'] as const,
    historyRetentionDays: null as number | null,
    hasWatermark: false,
    capabilities: {
      voice_message_understanding: true,
    },
    featuresFr: [
      'Jusqu’à 2 Agents IA WhatsApp',
      'Jusqu’à 2 Numéros WhatsApp connectés',
      'Compréhension des messages vocaux (FR & EN) incluse sans frais',
      'Conversations quotidiennes sans quota INNOICA',
      'Réponses IA quotidiennes sans quota INNOICA',
      'Connaissances complètes : FAQ, PDF, TXT & URL',
      'Mémoire durable par contact & conversation',
      'Inbox temps réel & Human Takeover',
      'Historique étendu & journaux complets',
      'Sans signature publicitaire INNOICA',
    ],
    featuresEn: [
      'Up to 2 WhatsApp AI Agents',
      'Up to 2 Connected WhatsApp numbers',
      'Voice message understanding (FR & EN) included at no extra fee',
      'No INNOICA daily conversation cap',
      'No INNOICA daily AI reply cap',
      'Full Knowledge Base: FAQ, PDF, TXT & URL',
      'Durable contact & conversation memory',
      'Real-time Inbox & Human Takeover',
      'Extended history & supervision logs',
      'No INNOICA promotional signature',
    ],
  },
} as const;

export const DEFAULT_WATERMARK_TEMPLATE_FR =
  'Cet assistant fonctionne avec Innoica Agent Studio. Créez votre propre agent WhatsApp : {url}';
export const DEFAULT_WATERMARK_TEMPLATE_EN =
  'Powered by Innoica Agent Studio. Create your own WhatsApp agent: {url}';

export const VOICE_FREE_PLAN_MESSAGES = {
  fr: 'Merci pour votre message vocal. Pour le moment, cet assistant peut uniquement traiter les messages écrits. Veuillez écrire votre demande afin que je puisse vous aider.',
  en: 'Thank you for your voice message. This assistant can currently process written messages only. Please type your request so I can help you.',
} as const;

export const VOICE_FALLBACK_MESSAGES = {
  no_speech: {
    fr: 'Je n’ai pas entendu de paroles intelligibles dans votre message vocal. Pourriez-vous réenregistrer votre message dans un endroit calme ou me l’écrire par texte ?',
    en: 'I could not hear clear speech in your voice message. Could you record it again in a quieter place or type your request?',
  },
  unsupported: {
    fr: 'Ce format audio ne peut pas être traité pour le moment. Pourriez-vous renvoyer une note vocale WhatsApp ou écrire votre message ?',
    en: 'This audio format cannot be processed right now. Could you send a standard WhatsApp voice note or type your message?',
  },
  processing_error: {
    fr: 'Je rencontre une difficulté technique temporaire pour écouter votre message vocal. Pourriez-vous l’écrire en quelques mots afin que je vous réponde immédiatement ?',
    en: 'I am experiencing a temporary technical issue processing your voice message. Could you type it briefly so I can help you right away?',
  },
  insufficient: {
    fr: 'Je n’ai pas réussi à comprendre clairement votre message vocal. Pourriez-vous préciser votre demande par écrit ou dans un vocal plus net ?',
    en: 'I could not clearly understand your voice message. Could you clarify your request in writing or in a clearer voice note?',
  },
  ambiguous_language: {
    fr: 'Je n’ai pas bien saisi votre message vocal. Pourriez-vous me le préciser en français ou en anglais ?',
    en: 'I could not clearly understand your voice message. Could you clarify it in French or English?',
  },
} as const;

export function resolveVoiceCapabilities(options: {
  planSlug?: string | null;
  capabilities?: Record<string, unknown> | null;
  subscriptionStatus?: string | null;
}): { voice_message_understanding: boolean } {
  const slug = (options.planSlug || 'free').toLowerCase();
  if (slug === 'free') {
    return { voice_message_understanding: false };
  }
  const status = (options.subscriptionStatus || 'active').toLowerCase();
  if (!['active', 'trialing'].includes(status)) {
    return { voice_message_understanding: false };
  }
  const explicit = options.capabilities?.voice_message_understanding;
  if (typeof explicit === 'boolean') {
    return { voice_message_understanding: explicit };
  }
  return { voice_message_understanding: true };
}

export function getAfricaDoualaDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_CONFIG.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function resolveOfficialAppUrl(configuredValue?: string | null): string {
  const candidate = (configuredValue || '').trim();
  if (candidate) {
    if (candidate.startsWith('http://') || candidate.startsWith('https://')) {
      return candidate.replace(/\/+$/, '');
    }
    return `https://${candidate.replace(/^\/+|\/+$/g, '')}`;
  }

  if (typeof process !== 'undefined' && process.env) {
    const publicAppUrl = (process.env.NEXT_PUBLIC_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || '').trim();
    if (publicAppUrl) {
      return publicAppUrl.replace(/\/+$/, '');
    }
    const domain = (process.env.DOMAIN || '').trim();
    if (domain) {
      return domain.startsWith('http') ? domain.replace(/\/+$/, '') : `https://${domain.replace(/\/+$/, '')}`;
    }
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
    if (appUrl && !appUrl.includes('localhost') && !appUrl.includes('127.0.0.1')) {
      return appUrl.replace(/\/+$/, '');
    }
  }

  return APP_CONFIG.officialProductionUrl;
}

export function buildWatermarkText(options?: {
  language?: 'fr' | 'en';
  templateFr?: string | null;
  templateEn?: string | null;
  officialUrl?: string | null;
}): string {
  const url = resolveOfficialAppUrl(options?.officialUrl);
  const template =
    options?.language === 'en'
      ? (options?.templateEn?.trim() || DEFAULT_WATERMARK_TEMPLATE_EN)
      : (options?.templateFr?.trim() || DEFAULT_WATERMARK_TEMPLATE_FR);
  return template.includes('{url}') ? template.replace(/\{url\}/g, url) : `${template} ${url}`;
}

export function applyPlanWatermark(
  replyText: string,
  options: {
    hasWatermark: boolean;
    language?: 'fr' | 'en';
    templateFr?: string | null;
    templateEn?: string | null;
    officialUrl?: string | null;
  }
): string {
  const clean = replyText.trim();
  if (!options.hasWatermark || !clean) {
    return clean;
  }

  const signature = buildWatermarkText(options);
  if (clean.includes(signature)) {
    return clean;
  }

  const officialUrl = resolveOfficialAppUrl(options.officialUrl);
  if (clean.includes('Innoica Agent Studio') && clean.includes(officialUrl)) {
    return clean;
  }

  return `${clean}\n\n${signature}`;
}

export function sanitizeKnowledgeContent(input: string): string {
  return input
    .replace(/\u0000/g, '')
    .replace(/<\/?connaissances_autorisees>/gi, '[donnee]')
    .replace(/<\/?untrusted_knowledge>/gi, '[donnee]')
    .replace(/<\/?system>/gi, '[donnee]')
    .replace(/<\/?instructions>/gi, '[donnee]')
    .trim();
}

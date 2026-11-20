// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Zod Validation Schemas
// ====================================================================

import { z } from 'zod';

/**
 * Validation stricte du numéro WhatsApp au format international E.164
 * Exemple : +237691234567 (Cameroun), +33612345678 (France)
 */
export const internationalPhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, {
    message: 'Le numéro doit être au format international avec indicatif (ex: +237691234567)',
  });

/**
 * Normalisation d'un numéro pour l'API Baileys (uniquement chiffres)
 */
export function normalizePhoneNumberForBaileys(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * Schéma pour la saisie de clé API BYOK
 */
export const aiCredentialCreateSchema = z.object({
  provider: z.enum(['openrouter', 'groq', 'gemini', 'openai'], {
    required_error: 'Veuillez sélectionner un fournisseur IA',
  }),
  label: z
    .string()
    .trim()
    .min(2, 'Le libellé doit comporter au moins 2 caractères')
    .max(50, 'Le libellé ne doit pas dépasser 50 caractères'),
  apiKey: z
    .string()
    .trim()
    .min(10, 'La clé API semble trop courte')
    .max(500, 'La clé API est trop longue'),
});

/**
 * Schéma de création / modification d'un Agent
 */
export const agentFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de l'agent doit comporter au moins 2 caractères")
    .max(60, "Le nom ne peut pas dépasser 60 caractères"),
  description: z
    .string()
    .trim()
    .max(300, "La description ne doit pas dépasser 300 caractères")
    .optional(),
  template_slug: z.string().optional(),
  primary_language: z.enum(['fr', 'en'], {
    required_error: 'Veuillez choisir la langue principale',
  }),
  system_prompt: z
    .string()
    .trim()
    .min(10, "Les instructions système doivent comporter au moins 10 caractères")
    .max(5000, "Les instructions ne doivent pas dépasser 5000 caractères"),
  personality_traits: z.array(z.string()).default([]),
  ai_provider: z.enum(['openrouter', 'groq', 'gemini', 'openai']),
  ai_model: z.string().min(2, 'Veuillez sélectionner un modèle IA'),
  ai_temperature: z.number().min(0).max(1).default(0.7),
  is_memory_enabled: z.boolean().default(true),
  ai_credential_id: z.string().uuid().optional().nullable(),
});

/**
 * Schéma pour la demande de Pairing Code
 */
export const requestPairingCodeSchema = z.object({
  agentId: z.string().uuid("ID d'agent invalide"),
  phoneNumber: internationalPhoneSchema,
});

/**
 * Schéma pour l'ajout d'une FAQ dans la base de connaissances
 */
export const knowledgeFaqSchema = z.object({
  agentId: z.string().uuid(),
  question: z.string().trim().min(3, 'La question est trop courte').max(300),
  answer: z.string().trim().min(3, 'La réponse est trop courte').max(3000),
});

/**
 * Schéma pour l'ajout d'une URL web publique
 */
export const knowledgeUrlSchema = z.object({
  agentId: z.string().uuid(),
  title: z.string().trim().max(100).optional(),
  url: z
    .string()
    .trim()
    .url("L'URL fournie est invalide")
    .refine((val) => val.startsWith('http://') || val.startsWith('https://'), {
      message: 'Seuls les protocoles HTTP et HTTPS sont autorisés',
    }),
});

/**
 * Schéma pour la déclaration manuelle de paiement (Agent, Commerce ou Starter)
 */
export const paymentDeclarationSchema = z.object({
  planSlug: z.enum(['agent', 'commerce', 'starter']).default('agent'),
  billingCycle: z.enum(['monthly', 'yearly']),
  paymentMethod: z
    .string()
    .trim()
    .min(2, 'Moyen de paiement requis (ex: Orange Money, MTN MoMo, Carte)'),
  reference: z
    .string()
    .trim()
    .min(3, 'Référence de transaction requise')
    .max(100, 'Référence trop longue'),
  paidAt: z.string().trim().optional(),
  proofNote: z.string().trim().max(500).optional(),
});

/**
 * Schéma Admin d'approbation/rejet de déclaration de paiement
 */
export const adminPaymentDecisionSchema = z.object({
  declarationId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  reviewNote: z.string().trim().max(500).optional(),
});

/**
 * Schéma Admin de mise à jour des limites d'un plan
 */
export const adminPlanConfigSchema = z.object({
  slug: z.enum(['free', 'agent', 'commerce', 'starter']),
  price_monthly_xaf: z.number().min(0).max(10000000),
  price_yearly_xaf: z.number().min(0).max(100000000),
  max_agents: z.number().int().min(1).max(100),
  max_connections: z.number().int().min(1).max(100),
  max_knowledge_docs: z.number().int().min(1).max(500),
  max_daily_new_conversations: z.number().int().min(1).nullable(),
  max_daily_bot_replies_per_conv: z.number().int().min(1).nullable(),
  history_retention_days: z.number().int().min(1).nullable(),
  has_watermark: z.boolean(),
  capabilities: z
    .object({
      voice_message_understanding: z.boolean().optional(),
      ecommerce_store: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Schéma de mise à jour / création de mémoire contact ou conversation
 */
export const memoryUpsertSchema = z.object({
  scope: z.enum(['contact', 'conversation']),
  targetId: z.string().uuid(),
  key: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(500),
});

/**
 * Schéma de message envoyé manuellement par un opérateur humain
 */
export const sendHumanMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().trim().min(1, 'Le message ne peut pas être vide').max(2000),
});

/**
 * Schéma de changement de mode de contrôle conversationnel
 */
export const changeControlModeSchema = z.object({
  conversationId: z.string().uuid(),
  controlMode: z.enum(['ai_active', 'human_takeover', 'paused']),
});

export * from './ecommerce';
export * from './automation';

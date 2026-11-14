import { describe, it, expect } from 'vitest';
import {
  internationalPhoneSchema,
  normalizePhoneNumberForBaileys,
  aiCredentialCreateSchema,
  agentFormSchema,
} from '../schemas/index.js';

describe('Zod Validation Schemas', () => {
  describe('International Phone Number Validation', () => {
    it('should validate valid international numbers', () => {
      expect(internationalPhoneSchema.safeParse('+237691234567').success).toBe(true);
      expect(internationalPhoneSchema.safeParse('+33612345678').success).toBe(true);
      expect(internationalPhoneSchema.safeParse('+14155552671').success).toBe(true);
    });

    it('should reject local or invalid phone numbers without country code', () => {
      expect(internationalPhoneSchema.safeParse('691234567').success).toBe(false);
      expect(internationalPhoneSchema.safeParse('0612345678').success).toBe(false);
      expect(internationalPhoneSchema.safeParse('invalid').success).toBe(false);
      expect(internationalPhoneSchema.safeParse('+').success).toBe(false);
    });

    it('should properly normalize phone numbers for Baileys', () => {
      expect(normalizePhoneNumberForBaileys('+237 691-23-45-67')).toBe('237691234567');
      expect(normalizePhoneNumberForBaileys('+33 6 12 34 56 78')).toBe('33612345678');
    });
  });

  describe('AI Credential Schema', () => {
    it('should validate valid provider and API key', () => {
      const res = aiCredentialCreateSchema.safeParse({
        provider: 'openrouter',
        label: 'Ma clé OpenRouter',
        apiKey: 'sk-or-v1-abcdef1234567890abcdef',
      });
      expect(res.success).toBe(true);
    });

    it('should reject unknown providers', () => {
      const res = aiCredentialCreateSchema.safeParse({
        provider: 'unknown-provider',
        label: 'Ma clé',
        apiKey: 'sk-1234567890abcdef',
      });
      expect(res.success).toBe(false);
    });
  });

  describe('Agent Form Schema', () => {
    it('should validate a complete agent configuration', () => {
      const res = agentFormSchema.safeParse({
        name: 'Mon Agent Accueil',
        description: 'Agent de réception pour la boutique',
        primary_language: 'fr',
        system_prompt: 'Tu es un agent d accueil professionnel et bienveillant.',
        personality_traits: ['Courtois', 'Efficace'],
        ai_provider: 'openrouter',
        ai_model: 'meta-llama/llama-3.3-70b-instruct',
        ai_temperature: 0.7,
        is_memory_enabled: true,
      });
      expect(res.success).toBe(true);
    });

    it('should reject an agent with empty or too short system prompt', () => {
      const res = agentFormSchema.safeParse({
        name: 'Agent Invalide',
        primary_language: 'fr',
        system_prompt: 'Court', // < 10 chars
        ai_provider: 'openrouter',
        ai_model: 'meta-llama/llama-3.3-70b-instruct',
      });
      expect(res.success).toBe(false);
    });
  });
});

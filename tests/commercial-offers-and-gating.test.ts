import { describe, it, expect } from 'vitest';
import {
  PLAN_CATALOG,
  resolveCommerceCapabilities,
  resolveVoiceCapabilities,
  paymentDeclarationSchema,
  adminPlanConfigSchema,
} from '../packages/shared/src/index';
import {
  hasCommerceCapability,
  requireCommerceCapability,
  assertCommerceApiAccess,
  FeatureGateError,
} from '../apps/web/src/lib/feature-gating';

describe('Milestone 2: Commercial Offers & Feature Gating', () => {
  describe('PLAN_CATALOG Invariants', () => {
    it('guarantees INNOICA Agent pricing and capabilities', () => {
      const plan = PLAN_CATALOG.agent;
      expect(plan.id).toBe('agent');
      expect(plan.slug).toBe('agent');
      expect(plan.nameFr).toBe('INNOICA Agent');
      expect(plan.priceMonthly).toBe(3500);
      expect(plan.priceYearly).toBe(37800);
      expect(plan.annualFullPrice).toBe(42000);
      expect(plan.annualSavings).toBe(4200);
      expect(plan.annualDiscountPercent).toBe(10);
      expect(plan.maxAgents).toBe(2);
      expect(plan.maxConnections).toBe(2);
      expect(plan.hasWatermark).toBe(false);
      expect(plan.capabilities.voice_message_understanding).toBe(true);
      expect(plan.capabilities.ecommerce_store).toBe(false);
    });

    it('guarantees INNOICA Commerce pricing and capabilities', () => {
      const plan = PLAN_CATALOG.commerce;
      expect(plan.id).toBe('commerce');
      expect(plan.slug).toBe('commerce');
      expect(plan.nameFr).toBe('INNOICA Commerce');
      expect(plan.priceMonthly).toBe(6500);
      expect(plan.priceYearly).toBe(70200);
      expect(plan.annualFullPrice).toBe(78000);
      expect(plan.annualSavings).toBe(7800);
      expect(plan.annualDiscountPercent).toBe(10);
      expect(plan.maxAgents).toBe(3);
      expect(plan.maxConnections).toBe(3);
      expect(plan.hasWatermark).toBe(false);
      expect(plan.capabilities.voice_message_understanding).toBe(true);
      expect(plan.capabilities.ecommerce_store).toBe(true);
    });

    it('preserves Free plan strictly unchanged', () => {
      const plan = PLAN_CATALOG.free;
      expect(plan.priceMonthly).toBe(0);
      expect(plan.priceYearly).toBe(0);
      expect(plan.maxAgents).toBe(1);
      expect(plan.maxConnections).toBe(1);
      expect(plan.maxDailyNewConversations).toBe(5);
      expect(plan.maxDailyBotRepliesPerConv).toBe(10);
      expect(plan.historyRetentionDays).toBe(7);
      expect(plan.hasWatermark).toBe(true);
      expect(plan.capabilities.voice_message_understanding).toBe(false);
      expect(plan.capabilities.ecommerce_store).toBe(false);
    });

    it('preserves Grandfathered Starter plan intact', () => {
      const plan = PLAN_CATALOG.starter;
      expect(plan.priceMonthly).toBe(5000);
      expect(plan.priceYearly).toBe(54000);
      expect(plan.maxAgents).toBe(2);
      expect(plan.maxConnections).toBe(2);
      expect(plan.hasWatermark).toBe(false);
      expect(plan.capabilities.voice_message_understanding).toBe(true);
      expect(plan.capabilities.ecommerce_store).toBe(false);
    });
  });

  describe('Capability Resolution Helpers', () => {
    it('correctly resolves ecommerce capabilities', () => {
      expect(resolveCommerceCapabilities({ planSlug: 'free' }).ecommerce_store).toBe(false);
      expect(resolveCommerceCapabilities({ planSlug: 'agent' }).ecommerce_store).toBe(false);
      expect(resolveCommerceCapabilities({ planSlug: 'starter' }).ecommerce_store).toBe(false);
      expect(resolveCommerceCapabilities({ planSlug: 'commerce' }).ecommerce_store).toBe(true);

      // Inactive or cancelled subscription blocks ecommerce
      expect(
        resolveCommerceCapabilities({ planSlug: 'commerce', subscriptionStatus: 'cancelled' })
          .ecommerce_store
      ).toBe(false);

      // Explicit override capability
      expect(
        resolveCommerceCapabilities({
          planSlug: 'agent',
          capabilities: { ecommerce_store: true },
        }).ecommerce_store
      ).toBe(true);
    });

    it('correctly resolves voice capabilities across all tiers', () => {
      expect(resolveVoiceCapabilities({ planSlug: 'free' }).voice_message_understanding).toBe(false);
      expect(resolveVoiceCapabilities({ planSlug: 'agent' }).voice_message_understanding).toBe(true);
      expect(resolveVoiceCapabilities({ planSlug: 'commerce' }).voice_message_understanding).toBe(true);
      expect(resolveVoiceCapabilities({ planSlug: 'starter' }).voice_message_understanding).toBe(true);
    });
  });

  describe('Server-Side Feature Gating (requireCommerceCapability)', () => {
    it('allows access for Commerce plan with active subscription', () => {
      const mockCommerceContext: any = {
        user: { id: 'u1' },
        workspace: { id: 'ws1' },
        quota: {
          planSlug: 'commerce',
          subscriptionStatus: 'active',
          capabilities: {
            voice_message_understanding: true,
            ecommerce_store: true,
          },
        },
      };

      expect(hasCommerceCapability(mockCommerceContext)).toBe(true);
      expect(requireCommerceCapability(mockCommerceContext)).toBe(true);
      expect(assertCommerceApiAccess(mockCommerceContext)).toBeNull();
    });

    it('blocks access for Agent plan (403 Forbidden)', () => {
      const mockAgentContext: any = {
        user: { id: 'u2' },
        workspace: { id: 'ws2' },
        quota: {
          planSlug: 'agent',
          subscriptionStatus: 'active',
          capabilities: {
            voice_message_understanding: true,
            ecommerce_store: false,
          },
        },
      };

      expect(hasCommerceCapability(mockAgentContext)).toBe(false);
      expect(() => requireCommerceCapability(mockAgentContext)).toThrow(FeatureGateError);

      try {
        requireCommerceCapability(mockAgentContext);
      } catch (err: any) {
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('COMMERCE_PLAN_REQUIRED');
      }

      const apiGateRes = assertCommerceApiAccess(mockAgentContext);
      expect(apiGateRes).not.toBeNull();
      expect(apiGateRes?.status).toBe(403);
    });

    it('blocks access for Free and Starter plans', () => {
      const mockFreeContext: any = {
        user: { id: 'u3' },
        workspace: { id: 'ws3' },
        quota: {
          planSlug: 'free',
          subscriptionStatus: 'active',
          capabilities: {
            voice_message_understanding: false,
            ecommerce_store: false,
          },
        },
      };
      expect(hasCommerceCapability(mockFreeContext)).toBe(false);
      expect(() => requireCommerceCapability(mockFreeContext)).toThrow(FeatureGateError);

      const mockStarterContext: any = {
        user: { id: 'u4' },
        workspace: { id: 'ws4' },
        quota: {
          planSlug: 'starter',
          subscriptionStatus: 'active',
          capabilities: {
            voice_message_understanding: true,
            ecommerce_store: false,
          },
        },
      };
      expect(hasCommerceCapability(mockStarterContext)).toBe(false);
      expect(() => requireCommerceCapability(mockStarterContext)).toThrow(FeatureGateError);
    });
  });

  describe('Zod Schemas Validation for New Plans', () => {
    it('validates paymentDeclarationSchema with planSlug', () => {
      // Default to agent when omitted
      const parsedDefault = paymentDeclarationSchema.safeParse({
        billingCycle: 'monthly',
        paymentMethod: 'Orange Money',
        reference: 'OM-2026-1100',
      });
      expect(parsedDefault.success).toBe(true);
      if (parsedDefault.success) {
        expect(parsedDefault.data.planSlug).toBe('agent');
      }

      // Explicit Commerce
      const parsedCommerce = paymentDeclarationSchema.safeParse({
        planSlug: 'commerce',
        billingCycle: 'yearly',
        paymentMethod: 'MTN MoMo',
        reference: 'MOMO-2026-9900',
      });
      expect(parsedCommerce.success).toBe(true);
      if (parsedCommerce.success) {
        expect(parsedCommerce.data.planSlug).toBe('commerce');
      }

      // Explicit Starter
      const parsedStarter = paymentDeclarationSchema.safeParse({
        planSlug: 'starter',
        billingCycle: 'monthly',
        paymentMethod: 'Virement bancaire',
        reference: 'VIR-2026-3300',
      });
      expect(parsedStarter.success).toBe(true);
      if (parsedStarter.success) {
        expect(parsedStarter.data.planSlug).toBe('starter');
      }

      // Rejects invalid slug
      const parsedInvalid = paymentDeclarationSchema.safeParse({
        planSlug: 'enterprise',
        billingCycle: 'monthly',
        paymentMethod: 'OM',
        reference: 'REF-1',
      });
      expect(parsedInvalid.success).toBe(false);
    });

    it('validates adminPlanConfigSchema for agent and commerce', () => {
      const parsedAgent = adminPlanConfigSchema.safeParse({
        slug: 'agent',
        price_monthly_xaf: 3500,
        price_yearly_xaf: 37800,
        max_agents: 2,
        max_connections: 2,
        max_knowledge_docs: 25,
        max_daily_new_conversations: null,
        max_daily_bot_replies_per_conv: null,
        history_retention_days: null,
        has_watermark: false,
        capabilities: {
          voice_message_understanding: true,
          ecommerce_store: false,
        },
      });
      expect(parsedAgent.success).toBe(true);

      const parsedCommerce = adminPlanConfigSchema.safeParse({
        slug: 'commerce',
        price_monthly_xaf: 6500,
        price_yearly_xaf: 70200,
        max_agents: 3,
        max_connections: 3,
        max_knowledge_docs: 50,
        max_daily_new_conversations: null,
        max_daily_bot_replies_per_conv: null,
        history_retention_days: null,
        has_watermark: false,
        capabilities: {
          voice_message_understanding: true,
          ecommerce_store: true,
        },
      });
      expect(parsedCommerce.success).toBe(true);
    });
  });
});

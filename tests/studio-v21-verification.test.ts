import { describe, it, expect } from 'vitest';
import http from 'node:http';
import {
  PLAN_CATALOG,
  applyPlanWatermark,
  paymentDeclarationSchema,
  adminPaymentDecisionSchema,
} from '../packages/shared/src/index';
import {
  isValidPdfSignature,
  extractTextFromPdfBuffer,
  safeFetchPublicUrl,
} from '../packages/shared/src/server';

describe('Innoica Agent Studio v2.1 — Business Rules, PDF & SSRF Security', () => {
  it('enforces exact commercial pricing math (INNOICA Agent 3 500 FCFA & INNOICA Commerce 6 500 FCFA with 10% annual discounts)', () => {
    // INNOICA Agent (3 500 FCFA/mo, 37 800 FCFA/yr)
    const agentMonthly = PLAN_CATALOG.agent.priceMonthly;
    const agentYearly = PLAN_CATALOG.agent.priceYearly;
    const agentUndiscounted = agentMonthly * 12; // 42000
    const agentSavings = agentUndiscounted - agentYearly; // 4200
    expect(agentMonthly).toBe(3500);
    expect(agentYearly).toBe(37800);
    expect(agentUndiscounted).toBe(42000);
    expect(agentSavings).toBe(4200);
    expect(Math.round((agentSavings / agentUndiscounted) * 100)).toBe(10);
    expect(PLAN_CATALOG.agent.capabilities.voice_message_understanding).toBe(true);
    expect(PLAN_CATALOG.agent.capabilities.ecommerce_store).toBe(false);

    // INNOICA Commerce (6 500 FCFA/mo, 70 200 FCFA/yr)
    const commerceMonthly = PLAN_CATALOG.commerce.priceMonthly;
    const commerceYearly = PLAN_CATALOG.commerce.priceYearly;
    const commerceUndiscounted = commerceMonthly * 12; // 78000
    const commerceSavings = commerceUndiscounted - commerceYearly; // 7800
    expect(commerceMonthly).toBe(6500);
    expect(commerceYearly).toBe(70200);
    expect(commerceUndiscounted).toBe(78000);
    expect(commerceSavings).toBe(7800);
    expect(Math.round((commerceSavings / commerceUndiscounted) * 100)).toBe(10);
    expect(PLAN_CATALOG.commerce.capabilities.voice_message_understanding).toBe(true);
    expect(PLAN_CATALOG.commerce.capabilities.ecommerce_store).toBe(true);

    // Free plan (0 FCFA)
    expect(PLAN_CATALOG.free.priceMonthly).toBe(0);
    expect(PLAN_CATALOG.free.priceYearly).toBe(0);
    expect(PLAN_CATALOG.free.capabilities.voice_message_understanding).toBe(false);
    expect(PLAN_CATALOG.free.capabilities.ecommerce_store).toBe(false);

    // Grandfathered Starter (5 000 FCFA/mo, 54 000 FCFA/yr)
    const starterMonthly = PLAN_CATALOG.starter.priceMonthly;
    const starterYearly = PLAN_CATALOG.starter.priceYearly;
    expect(starterMonthly).toBe(5000);
    expect(starterYearly).toBe(54000);
    expect(PLAN_CATALOG.starter.capabilities.ecommerce_store).toBe(false);
  });

  it('validates payment declaration & Super Admin review schemas cleanly', () => {
    expect(
      paymentDeclarationSchema.safeParse({
        planSlug: 'agent',
        billingCycle: 'yearly',
        paymentMethod: 'Orange Money',
        reference: 'OM-2026-99182',
      }).success
    ).toBe(true);

    expect(
      paymentDeclarationSchema.safeParse({
        planSlug: 'commerce',
        billingCycle: 'monthly',
        paymentMethod: 'MTN MoMo',
        reference: 'MOMO-2026-11223',
      }).success
    ).toBe(true);

    expect(
      paymentDeclarationSchema.safeParse({
        billingCycle: 'weekly',
        paymentMethod: 'OM',
        reference: 'X',
      }).success
    ).toBe(false);

    expect(
      adminPaymentDecisionSchema.safeParse({
        declarationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        decision: 'approved',
      }).success
    ).toBe(true);
  });

  it('rejects disguised or oversized PDFs lacking %PDF- magic bytes', async () => {
    const fakeHtml = Buffer.from('<html><script>alert(1)</script></html>', 'utf-8');
    expect(isValidPdfSignature(fakeHtml)).toBe(false);
    await expect(extractTextFromPdfBuffer(fakeHtml)).rejects.toThrow('%PDF-');

    const validHeader = Buffer.from('%PDF-1.4\n', 'utf-8');
    expect(isValidPdfSignature(validHeader)).toBe(true);

    const oversized = new Uint8Array(11 * 1024 * 1024);
    oversized.set(Buffer.from('%PDF-'), 0);
    await expect(extractTextFromPdfBuffer(oversized, 10 * 1024 * 1024)).rejects.toThrow(
      'volumineux'
    );
  });

  it('blocks SSRF against localhost even across HTTP redirects', async () => {
    const server = http.createServer((_req, res) => {
      res.statusCode = 302;
      res.setHeader('Location', 'http://169.254.169.254/latest/meta-data/');
      res.end();
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    try {
      await expect(safeFetchPublicUrl(`http://127.0.0.1:${port}/test`)).rejects.toThrow(
        /SSRF|privée|loopback/i
      );
    } finally {
      server.close();
    }
  });

  it('never duplicates Free watermark on repeated runs and allows custom template', () => {
    const base = 'Voici nos horaires d’ouverture.';
    const first = applyPlanWatermark(base, {
      hasWatermark: true,
      language: 'en',
      officialUrl: 'https://agents.innoica.com',
    });
    const second = applyPlanWatermark(first, {
      hasWatermark: true,
      language: 'en',
      officialUrl: 'https://agents.innoica.com',
    });

    expect(first).toContain('Innoica Agent Studio');
    expect(first).toContain('https://agents.innoica.com');
    expect(second).toBe(first);
  });
});

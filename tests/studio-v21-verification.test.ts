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
  it('enforces exact launch pricing math (5 000 FCFA/mo, 54 000 FCFA/yr = 10% off 60 000 FCFA)', () => {
    const monthly = PLAN_CATALOG.starter.priceMonthly;
    const yearly = PLAN_CATALOG.starter.priceYearly;
    const undiscounted = monthly * 12;
    const savings = undiscounted - yearly;

    expect(monthly).toBe(5000);
    expect(yearly).toBe(54000);
    expect(undiscounted).toBe(60000);
    expect(savings).toBe(6000);
    expect(Math.round((savings / undiscounted) * 100)).toBe(10);
  });

  it('validates payment declaration & Super Admin review schemas cleanly', () => {
    expect(
      paymentDeclarationSchema.safeParse({
        billingCycle: 'yearly',
        paymentMethod: 'Orange Money',
        reference: 'OM-2026-99182',
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

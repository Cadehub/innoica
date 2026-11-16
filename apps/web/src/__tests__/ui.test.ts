import { describe, it, expect } from 'vitest';
import frMessages from '../../messages/fr.json';
import enMessages from '../../messages/en.json';
import { validateProviderApiKey } from '../lib/provider-tester';
import { config as middlewareConfig } from '../middleware';
import {
  COUNTRY_DIAL_CODES,
  parseE164Phone,
  formatE164Phone,
  PLAN_CATALOG,
} from '@innoica/shared';
import { splitTextIntoChunks, extractTextFromHtml } from '../lib/knowledge/ingestion';

describe('apps/web UI & i18n Qualification', () => {
  it('should have complete French and English translation keys matching', () => {
    expect(Object.keys(frMessages)).toEqual(Object.keys(enMessages));
    expect(frMessages.Common.appName).toBe('Innoica Agent Studio');
    expect(enMessages.Common.appName).toBe('Innoica Agent Studio');
    expect(frMessages.Subscription.yearly).toContain('-10%');
    expect(enMessages.Subscription.yearly).toContain('-10%');
    expect(PLAN_CATALOG.starter.priceMonthly).toBe(5000);
    expect(PLAN_CATALOG.starter.priceYearly).toBe(54000);
  });

  it('NON-NEGOTIABLE POLICY: Zero QR code mention in customer onboarding flows', () => {
    const frJsonStr = JSON.stringify(frMessages).toLowerCase();
    const enJsonStr = JSON.stringify(enMessages).toLowerCase();

    expect(frJsonStr).toContain('sans aucun qr');
    expect(enJsonStr).toContain('zero qr');

    expect(frJsonStr).not.toContain('scanner le qr');
    expect(enJsonStr).not.toContain('scan the qr');
    expect(frJsonStr).not.toContain('flasher le qr');
  });

  it('should have proper currency format for XAF / FCFA in Cameroon market', () => {
    expect(frMessages.Subscription.subtitle).toContain('FCFA');
    expect(enMessages.Subscription.subtitle).toContain('FCFA');
  });

  it('BYOK VALIDATION: should reject empty API key gracefully', async () => {
    const result = await validateProviderApiKey('groq', '');
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('vide');
  });

  it('MIDDLEWARE MATCHER: should strictly exclude /api/* routes from localization redirects', () => {
    const matcherRegex = new RegExp(middlewareConfig.matcher[0].replace(/^\//, '^/'));
    
    // /api/ai-credentials should NOT match the localization middleware
    expect(matcherRegex.test('/api/ai-credentials')).toBe(false);
    expect(matcherRegex.test('/api/ai-credentials/test')).toBe(false);
    expect(matcherRegex.test('/api/whatsapp/pair')).toBe(false);
    expect(matcherRegex.test('/api/knowledge/faq')).toBe(false);
    expect(matcherRegex.test('/api/knowledge/pdf')).toBe(false);
    expect(matcherRegex.test('/api/admin')).toBe(false);
    expect(matcherRegex.test('/_next/static/chunk.js')).toBe(false);

    // Regular localized paths SHOULD match
    expect(matcherRegex.test('/dashboard')).toBe(true);
    expect(matcherRegex.test('/agents')).toBe(true);
    expect(matcherRegex.test('/ai-credentials')).toBe(true);
  });

  it('PHONE INPUT & COUNTRY CODES: should parse and format E.164 numbers with zero emojis', () => {
    const emojiRegex = /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(COUNTRY_DIAL_CODES.length).toBeGreaterThan(20);
    for (const c of COUNTRY_DIAL_CODES) {
      expect(emojiRegex.test(c.name)).toBe(false);
      expect(emojiRegex.test(c.iso)).toBe(false);
    }

    expect(parseE164Phone('+237691234567')).toEqual({ dialCode: '237', localNumber: '691234567' });
    expect(parseE164Phone('+33612345678')).toEqual({ dialCode: '33', localNumber: '612345678' });
    expect(parseE164Phone('+14155551212')).toEqual({ dialCode: '1', localNumber: '4155551212' });
    expect(formatE164Phone('237', '691 23 45 67')).toBe('+237691234567');
  });

  it('KNOWLEDGE INGESTION: should clean HTML and split text into chunks', () => {
    const html = '<html><head><title>Tarifs INNOICA</title><script>alert(1)</script></head><body><h1>Offres</h1><p>Starter 15000 FCFA</p></body></html>';
    const extracted = extractTextFromHtml(html);
    expect(extracted.title).toBe('Tarifs INNOICA');
    expect(extracted.content).toContain('Starter 15000 FCFA');
    expect(extracted.content).not.toContain('alert(1)');

    const chunks = splitTextIntoChunks('A'.repeat(1200), 800, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('LANDING PAGE RESPONSIVENESS & STICKY TOP INVARIANTS: verifies sticky header, overflow-x-clip and mobile drawer', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const landingFile = fs.readFileSync(
      path.resolve(__dirname, '../components/landing-client.tsx'),
      'utf-8'
    );

    // Root container must use overflow-x-clip rather than overflow-x-hidden to avoid breaking position: sticky
    expect(landingFile).toContain('overflow-x-clip');
    expect(landingFile).not.toContain('min-h-screen bg-[#fafafb] text-zinc-900 overflow-x-hidden');

    // Sticky top navigation bar
    expect(landingFile).toContain('sticky top-0 z-50');
    expect(landingFile).toContain('backdrop-blur-md');

    // Mobile menu drawer and toggle button
    expect(landingFile).toContain('mobileMenuOpen');
    expect(landingFile).toContain('setMobileMenuOpen');
    expect(landingFile).toContain('md:hidden');

    // Animations classes
    expect(landingFile).toContain('animate-fade-in-up');
    expect(landingFile).toContain('animation-delay-75');
    expect(landingFile).toContain('hover-card-lift');
  });

  it('DASHBOARD SHELL LATERAL MENU INVARIANTS: prevents button tangling when collapsed', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const shellFile = fs.readFileSync(
      path.resolve(__dirname, '../app/[locale]/(dashboard)/dashboard-shell.tsx'),
      'utf-8'
    );

    // Aside must transition smoothly and prevent overflow spilling when shrinking
    expect(shellFile).toContain('transition-all duration-200');
    expect(shellFile).toContain('overflow-hidden');

    // Header in sidebar must adapt when collapsed without button overlap
    expect(shellFile).toContain('lg:flex-col lg:items-center');
    expect(shellFile).toContain('PanelLeftOpen');
    expect(shellFile).toContain('PanelLeftClose');

    // Footer actions must be cleanly aligned when collapsed without tangling logout button
    expect(shellFile).toContain('lg:flex-col lg:justify-center');
  });

  it('INBOX CLIENT LATERAL INSPECTOR & ACTION BUTTONS: strict flex alignment and shrink-0', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const inboxFile = fs.readFileSync(
      path.resolve(__dirname, '../app/[locale]/(dashboard)/conversations/inbox-client.tsx'),
      'utf-8'
    );

    // Thread header buttons must not crush or tangle
    expect(inboxFile).toContain('min-w-0 flex-1 overflow-hidden');
    expect(inboxFile).toContain('flex items-center gap-2 shrink-0');
    expect(inboxFile).toContain('PanelRight');
  });
});

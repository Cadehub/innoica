import { describe, it, expect } from 'vitest';
import frMessages from '../../messages/fr.json';
import enMessages from '../../messages/en.json';
import { validateProviderApiKey } from '../lib/provider-tester';
import { config as middlewareConfig } from '../middleware';

describe('apps/web UI & i18n Qualification', () => {
  it('should have complete French and English translation keys matching', () => {
    expect(Object.keys(frMessages)).toEqual(Object.keys(enMessages));
    expect(frMessages.Common.appName).toBe('INNOICA WhatsApp Agents');
    expect(enMessages.Common.appName).toBe('INNOICA WhatsApp Agents');
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
    expect(matcherRegex.test('/_next/static/chunk.js')).toBe(false);

    // Regular localized paths SHOULD match
    expect(matcherRegex.test('/dashboard')).toBe(true);
    expect(matcherRegex.test('/agents')).toBe(true);
    expect(matcherRegex.test('/ai-credentials')).toBe(true);
  });
});

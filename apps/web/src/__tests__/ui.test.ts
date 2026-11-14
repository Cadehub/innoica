import { describe, it, expect } from 'vitest';
import frMessages from '../../messages/fr.json';
import enMessages from '../../messages/en.json';

describe('apps/web UI & i18n Qualification', () => {
  it('should have complete French and English translation keys matching', () => {
    expect(Object.keys(frMessages)).toEqual(Object.keys(enMessages));
    expect(frMessages.Common.appName).toBe('INNOICA WhatsApp Agents');
    expect(enMessages.Common.appName).toBe('INNOICA WhatsApp Agents');
  });

  it('NON-NEGOTIABLE POLICY: Zero QR code mention in customer onboarding flows', () => {
    // Vérifier que la documentation et les messages utilisateurs n'introduisent aucun QR
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
});

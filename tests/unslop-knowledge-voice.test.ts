import { describe, it, expect } from 'vitest';
import { resolveDominantLanguage } from '../services/ai-runtime/src/voice-comprehension.js';

describe('Unslop & Knowledge & Voice E2E Integration Suite', () => {
  it('should resolve dominant language dynamically to match contact inquiry in French and English', () => {
    // 1. French text
    const langFr = resolveDominantLanguage({
      incomingText: 'Bonjour, quels sont vos tarifs pour la création d’un site web vitrine à Douala ?',
      agentLanguage: 'en',
    });
    expect(langFr).toBe('fr');

    // 2. English text
    const langEn = resolveDominantLanguage({
      incomingText: 'Hello, how much is your Starter plan for my business?',
      agentLanguage: 'fr',
    });
    expect(langEn).toBe('en');

    // 3. Audio voice detection signal
    const langVoiceEn = resolveDominantLanguage({
      detectedLanguage: 'en',
      preferredLanguage: 'fr',
      agentLanguage: 'fr',
    });
    expect(langVoiceEn).toBe('en');

    const langVoiceFr = resolveDominantLanguage({
      detectedLanguage: 'fr',
      preferredLanguage: 'en',
      agentLanguage: 'en',
    });
    expect(langVoiceFr).toBe('fr');
  });

  it('should verify local speech worker health and offline Whisper model readiness', async () => {
    const res = await fetch('http://127.0.0.1:4004/health');
    expect(res.status).toBe(200);
    const health = await res.json();
    expect(health.ok).toBe(true);
    expect(health.status).toBe('ok');
    expect(health.engine).toBe('faster-whisper-ctranslate2');
    expect(health.paidApiFallback).toBe(false);
    expect(health.modelLoaded).toBe(true);
    expect(health.modelSize).toBe('base');
    expect(health.computeType).toBe('int8');
  });

  it('should verify Next.js production server serves the unslop interface', async () => {
    const res = await fetch('http://localhost:3000/fr');
    expect(res.status).toBe(200);
    const html = await res.text();
    // Verify unslop signature
    expect(html).toContain('INNOICA');
    // Verify removal of AI slop tells
    expect(html).not.toContain('card-3d-tilt');
    expect(html).not.toContain('perspective-3d');
    expect(html).not.toContain('animate-float-slow');
    // Verify voice note showcase
    expect(html).toContain('Message Vocal');
    expect(html).toContain('5 000 FCFA');
  });
});

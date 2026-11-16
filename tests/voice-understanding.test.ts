import { describe, it, expect } from 'vitest';
import {
  PLAN_CATALOG,
  VOICE_FALLBACK_MESSAGES,
  VOICE_FREE_PLAN_MESSAGES,
  applyPlanWatermark,
  resolveVoiceCapabilities,
} from '../packages/shared/src/index';
import {
  extractAudioDescriptor,
  inspectAudioMagicBytes,
  validateAudioMetadataBeforeDownload,
} from '../services/whatsapp-worker/src/handlers/audio-handler';
import {
  buildVoiceSystemDirectives,
  decideVoicePreLlmAction,
  detectSensitiveActionIntent,
  mergeClarificationState,
  parseAndStripVoiceState,
  resolveDominantLanguage,
} from '../services/ai-runtime/src/voice-comprehension';

describe('Innoica Voice Message Understanding — Commercial & Entitlement Rules', () => {
  it('enforces voice_message_understanding=false on Free and true on Starter & all active paid plans without altering pricing/quotas', () => {
    expect(PLAN_CATALOG.free.priceMonthly).toBe(0);
    expect(PLAN_CATALOG.free.maxDailyNewConversations).toBe(5);
    expect(PLAN_CATALOG.free.maxDailyBotRepliesPerConv).toBe(10);
    expect(PLAN_CATALOG.free.capabilities.voice_message_understanding).toBe(false);

    expect(PLAN_CATALOG.starter.priceMonthly).toBe(5000);
    expect(PLAN_CATALOG.starter.priceYearly).toBe(54000);
    expect(PLAN_CATALOG.starter.capabilities.voice_message_understanding).toBe(true);

    expect(resolveVoiceCapabilities({ planSlug: 'free', subscriptionStatus: 'active' })).toEqual({
      voice_message_understanding: false,
    });
    expect(resolveVoiceCapabilities({ planSlug: 'starter', subscriptionStatus: 'active' })).toEqual({
      voice_message_understanding: true,
    });
    expect(resolveVoiceCapabilities({ planSlug: 'pro', subscriptionStatus: 'active' })).toEqual({
      voice_message_understanding: true,
    });
    expect(resolveVoiceCapabilities({ planSlug: 'starter', subscriptionStatus: 'expired' })).toEqual({
      voice_message_understanding: false,
    });
  });

  it('produces exact official FR & EN written refusals for Free plan with Free watermark and no STT/LLM call', () => {
    const decisionFr = decideVoicePreLlmAction({
      hasVoiceUnderstanding: false,
      qualityCategory: 'high',
      transcript: 'ne doit jamais exister',
      language: 'fr',
    });
    expect(decisionFr.action).toBe('send_static');
    expect(decisionFr.staticReply).toBe(VOICE_FREE_PLAN_MESSAGES.fr);

    const decisionEn = decideVoicePreLlmAction({
      hasVoiceUnderstanding: false,
      qualityCategory: 'high',
      transcript: 'should not happen',
      language: 'en',
    });
    expect(decisionEn.action).toBe('send_static');
    expect(decisionEn.staticReply).toBe(VOICE_FREE_PLAN_MESSAGES.en);

    const watermarked = applyPlanWatermark(decisionFr.staticReply!, {
      hasWatermark: true,
      language: 'fr',
    });
    expect(watermarked).toContain(VOICE_FREE_PLAN_MESSAGES.fr);
    expect(watermarked).toContain('Innoica Agent Studio');
  });
});

describe('Innoica Voice Message Understanding — Media Security & Language/Comprehension', () => {
  it('extracts unwrapped & ephemeral WhatsApp audio descriptors and enforces size/duration/magic-byte validation', () => {
    const wrappedProto: any = {
      ephemeralMessage: {
        message: {
          audioMessage: {
            mimetype: 'audio/ogg; codecs=opus',
            seconds: 12,
            fileLength: 18420,
            ptt: true,
          },
        },
      },
    };
    const desc = extractAudioDescriptor(wrappedProto);
    expect(desc).not.toBeNull();
    expect(desc?.durationSeconds).toBe(12);
    expect(desc?.isVoiceNote).toBe(true);
    expect(validateAudioMetadataBeforeDownload(desc!).valid).toBe(true);

    const tooBig: any = { ...desc!, fileSizeBytes: 50 * 1024 * 1024 };
    const bigRes = validateAudioMetadataBeforeDownload(tooBig);
    expect(bigRes.valid).toBe(false);
    if (!bigRes.valid) expect(bigRes.errorCode).toBe('audio_too_large');

    const badMime: any = { ...desc!, mimeType: 'application/x-msdownload' };
    const mimeRes = validateAudioMetadataBeforeDownload(badMime);
    expect(mimeRes.valid).toBe(false);

    expect(inspectAudioMagicBytes(Buffer.from('OggS\x00\x02\x00\x00\x00\x00\x00\x00'))).toBe('ogg');
    expect(inspectAudioMagicBytes(Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00'))).toBeNull();
  });

  it('auto-detects dominant language (FR/EN) and routes high/partial/insufficient cases accurately', () => {
    expect(
      resolveDominantLanguage({ detectedLanguage: 'fr', agentLanguage: 'en', incomingText: 'Bonjour' })
    ).toBe('fr');
    expect(
      resolveDominantLanguage({ detectedLanguage: 'en', agentLanguage: 'fr', incomingText: 'Hello' })
    ).toBe('en');
    expect(
      resolveDominantLanguage({
        detectedLanguage: 'unknown',
        preferredLanguage: 'en',
        agentLanguage: 'fr',
        incomingText: 'ok',
      })
    ).toBe('en');

    const sufficient = decideVoicePreLlmAction({
      hasVoiceUnderstanding: true,
      qualityCategory: 'high',
      transcript: 'Bonjour, quel est le tarif de livraison à Douala ?',
      language: 'fr',
    });
    expect(sufficient.action).toBe('run_llm');
    expect(sufficient.comprehensionStatus).toBe('sufficient');

    const partial = decideVoicePreLlmAction({
      hasVoiceUnderstanding: true,
      qualityCategory: 'partial',
      transcript: 'Je veux commander deux... pour Bonapriso',
      language: 'fr',
    });
    expect(partial.action).toBe('run_llm');
    expect(partial.comprehensionStatus).toBe('partial');

    const noSpeech = decideVoicePreLlmAction({
      hasVoiceUnderstanding: true,
      qualityCategory: 'no_speech',
      transcript: '',
      language: 'en',
    });
    expect(noSpeech.action).toBe('send_static');
    expect(noSpeech.comprehensionStatus).toBe('insufficient');
    expect(noSpeech.staticReply).toBe(VOICE_FALLBACK_MESSAGES.no_speech.en);
  });

  it('strips internal voice state XML tags, guards sensitive actions, and merges voice-text clarifications cleanly', () => {
    const intent = detectSensitiveActionIntent('Je veux commander 3 cartons et payer par Orange Money');
    expect(intent).toBe('payment');

    const directives = buildVoiceSystemDirectives({
      isVoiceInput: true,
      language: 'fr',
      qualityCategory: 'partial',
      clarificationState: {
        validatedFacts: ['Ville: Douala'],
        ambiguousPoints: ['Quantité exacte'],
        missingDetails: ['Quartier de livraison'],
        awaitingConfirmation: true,
        proposedAction: 'order',
      },
      sensitiveIntent: 'order',
    });
    expect(directives).toContain('Ville: Douala');
    expect(directives).toContain('Quantité exacte');
    expect(directives).toContain('SÉCURITÉ ACTION SENSIBLE');

    const rawLlm =
      'J’ai bien noté Douala. Pouvez-vous confirmer si vous souhaitez 2 ou 3 unités ?\n<innoica_voice_state>{"comprehension":"partial","validated_facts":["Ville: Douala"],"ambiguous_points":["Quantité: 2 ou 3"],"missing_details":[],"awaiting_confirmation":true,"pending_topic":"commande","proposed_action":"order"}</innoica_voice_state>';

    const stripped = parseAndStripVoiceState(rawLlm);
    expect(stripped.cleanReply).not.toContain('<innoica_voice_state>');
    expect(stripped.parsedState?.comprehension).toBe('partial');

    const stateAfterVoice = mergeClarificationState(null, {
      sourceType: 'audio',
      incomingText: 'Livraison à Douala deux ou trois cartons',
      qualityCategory: 'partial',
      sensitiveIntent: 'order',
      parsedState: stripped.parsedState,
    });
    expect(stateAfterVoice?.awaitingConfirmation).toBe(true);
    expect(stateAfterVoice?.validatedFacts).toContain('Ville: Douala');

    // Follow-up text confirmation resolves ambiguity without losing validated facts
    const stateAfterTextConfirm = mergeClarificationState(stateAfterVoice, {
      sourceType: 'text',
      incomingText: 'Oui exactement, 2 unités',
      qualityCategory: null,
      sensitiveIntent: null,
      parsedState: {
        comprehension: 'sufficient',
        validated_facts: ['Quantité: 2 unités'],
        ambiguous_points: [],
        missing_details: [],
        awaiting_confirmation: false,
      },
    });
    expect(stateAfterTextConfirm?.awaitingConfirmation).toBe(false);
    expect(stateAfterTextConfirm?.validatedFacts).toEqual(['Ville: Douala', 'Quantité: 2 unités']);
  });
});

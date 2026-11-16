// ====================================================================
// INNOICA Agent Studio — Voice Comprehension & Clarification Engine
// ====================================================================

import {
  ClarificationState,
  SensitiveActionType,
  VOICE_FALLBACK_MESSAGES,
  VOICE_FREE_PLAN_MESSAGES,
  VoiceComprehensionStatus,
  VoiceQualityCategory,
} from '@innoica/shared';

export interface VoicePreDecision {
  action: 'send_static' | 'run_llm';
  staticReply?: string;
  comprehensionStatus: VoiceComprehensionStatus;
  reason?: string;
}

export interface ParsedVoiceStateTag {
  cleanReply: string;
  parsedState: {
    comprehension?: VoiceComprehensionStatus;
    validated_facts?: string[];
    ambiguous_points?: string[];
    missing_details?: string[];
    awaiting_confirmation?: boolean;
    pending_topic?: string | null;
    proposed_action?: SensitiveActionType | null;
  } | null;
}

const FRENCH_MARKERS = /\b(bonjour|bonsoir|salut|merci|combien|prix|livraison|commande|oui|non|svp|s'il vous plait|je veux|voudrais|besoin|pouvez|tarif)\b/i;
const ENGLISH_MARKERS = /\b(hello|hi|thanks|thank you|how much|price|delivery|order|yes|no|please|want|need|booking|available|help)\b/i;
const CONFIRMATION_MARKERS = /^(oui|ouais|ok|d'accord|exact|exactement|c'est ca|c'est ça|parfait|je confirme|yes|yeah|yep|correct|confirmed|sure|right|that's right)\b/i;

export function resolveDominantLanguage(params: {
  detectedLanguage?: string | null;
  preferredLanguage?: string | null;
  agentLanguage?: string | null;
  incomingText?: string | null;
}): 'fr' | 'en' {
  if (params.detectedLanguage === 'fr' || params.detectedLanguage === 'en') {
    return params.detectedLanguage;
  }

  const text = (params.incomingText || '').trim();
  if (text) {
    const frHits = FRENCH_MARKERS.test(text);
    const enHits = ENGLISH_MARKERS.test(text);
    if (frHits && !enHits) return 'fr';
    if (enHits && !frHits) return 'en';
  }

  if (params.preferredLanguage === 'fr' || params.preferredLanguage === 'en') {
    return params.preferredLanguage;
  }
  return params.agentLanguage === 'en' ? 'en' : 'fr';
}

export function decideVoicePreLlmAction(params: {
  hasVoiceUnderstanding: boolean;
  qualityCategory?: VoiceQualityCategory | string | null;
  transcript?: string | null;
  language: 'fr' | 'en';
}): VoicePreDecision {
  const lang = params.language;
  if (!params.hasVoiceUnderstanding) {
    return {
      action: 'send_static',
      staticReply: VOICE_FREE_PLAN_MESSAGES[lang],
      comprehensionStatus: 'insufficient',
      reason: 'free_plan',
    };
  }

  const q = params.qualityCategory || 'processing_error';
  if (q === 'no_speech') {
    return {
      action: 'send_static',
      staticReply: VOICE_FALLBACK_MESSAGES.no_speech[lang],
      comprehensionStatus: 'insufficient',
      reason: 'no_speech',
    };
  }
  if (q === 'unsupported') {
    return {
      action: 'send_static',
      staticReply: VOICE_FALLBACK_MESSAGES.unsupported[lang],
      comprehensionStatus: 'insufficient',
      reason: 'unsupported',
    };
  }
  if (q === 'processing_error') {
    return {
      action: 'send_static',
      staticReply: VOICE_FALLBACK_MESSAGES.processing_error[lang],
      comprehensionStatus: 'insufficient',
      reason: 'processing_error',
    };
  }

  const cleanTranscript = (params.transcript || '').trim();
  if (q === 'low' || !cleanTranscript) {
    return {
      action: 'send_static',
      staticReply: VOICE_FALLBACK_MESSAGES.insufficient[lang],
      comprehensionStatus: 'insufficient',
      reason: 'low_quality',
    };
  }

  if (q === 'partial') {
    return {
      action: 'run_llm',
      comprehensionStatus: 'partial',
    };
  }

  return {
    action: 'run_llm',
    comprehensionStatus: 'sufficient',
  };
}

export function detectSensitiveActionIntent(text: string): SensitiveActionType | null {
  const lower = (text || '').toLowerCase();
  if (!lower) return null;
  if (/(payer|paiement|mobile money|momo|orange money|virement|pay|payment|invoice|facture)/.test(lower)) {
    return 'payment';
  }
  if (/(annuler|annulation|cancel|refund|rembourser)/.test(lower)) {
    return 'cancellation';
  }
  if (/(commander|commande|acheter|achat|livrer|livraison|order|purchase|buy|deliver)/.test(lower)) {
    return 'order';
  }
  if (/(r[ée]server|r[ée]servation|rendez-vous|cr[ée]neau|book|booking|appointment|schedule)/.test(lower)) {
    return 'booking';
  }
  if (/(changer mon num[ée]ro|mettre [àa] jour mon profil|adresse de livraison|update my|change my phone)/.test(lower)) {
    return 'profile_update';
  }
  return null;
}

export function buildVoiceSystemDirectives(params: {
  isVoiceInput: boolean;
  language: 'fr' | 'en';
  qualityCategory?: VoiceQualityCategory | string | null;
  clarificationState?: ClarificationState | null;
  sensitiveIntent?: SensitiveActionType | null;
}): string {
  const lines: string[] = [];
  const state = params.clarificationState;
  const hasPendingState = Boolean(
    state &&
      (state.awaitingConfirmation ||
        (state.validatedFacts && state.validatedFacts.length > 0) ||
        (state.ambiguousPoints && state.ambiguousPoints.length > 0) ||
        (state.missingDetails && state.missingDetails.length > 0))
  );

  if (!params.isVoiceInput && !hasPendingState) {
    return '';
  }

  lines.push('\nDIRECTIVES MÉTIER — VOCAL & CLARIFICATION CONTEXTUELLE :');
  lines.push(
    `- Langue active de réponse : ${params.language === 'fr' ? 'Français' : 'Anglais'}. Réponds strictement dans cette langue.`
  );

  if (params.isVoiceInput) {
    lines.push(
      '- Le dernier message est issu d’un message vocal déjà transcrit dans sa langue originale. Comprends l’intention globale sans mentionner de scores numériques, pourcentages techniques ou noms de moteurs internes.'
    );
    if (params.qualityCategory === 'partial') {
      lines.push(
        '- ATTENTION TRANSCRIPTION PARTIELLE : reformule brièvement les éléments compris, ne devine aucune information manquante, et pose une question courte ciblée pour confirmer ou compléter uniquement les points ambigus.'
      );
    }
  }

  if (hasPendingState && state) {
    if (state.validatedFacts && state.validatedFacts.length > 0) {
      lines.push(`- Faits déjà validés à NE PAS redemander : ${state.validatedFacts.join(' | ')}`);
    }
    if (state.ambiguousPoints && state.ambiguousPoints.length > 0) {
      lines.push(`- Points encore ambigus à clarifier : ${state.ambiguousPoints.join(' | ')}`);
    }
    if (state.missingDetails && state.missingDetails.length > 0) {
      lines.push(`- Détails manquants requis : ${state.missingDetails.join(' | ')}`);
    }
    if (state.awaitingConfirmation && state.proposedAction) {
      lines.push(
        `- Action en attente de confirmation explicite : ${state.proposedAction}. Si le client confirme, finalise la réponse métier utile ; s’il corrige, fusionne ses corrections sans redemander ce qui est déjà validé.`
      );
    }
  }

  if (params.sensitiveIntent) {
    lines.push(
      `- SÉCURITÉ ACTION SENSIBLE (${params.sensitiveIntent}) : ne valide ni n’exécute aucune commande, réservation, paiement, annulation ou modification si les informations critiques sont ambiguës ou non confirmées explicitement par le client.`
    );
  }

  lines.push(
    '- Ajoute tout à la fin de ta réponse (jamais au milieu) une balise technique compacte sur une seule ligne qui sera masquée au client : <innoica_voice_state>{"comprehension":"sufficient|partial|insufficient","validated_facts":[],"ambiguous_points":[],"missing_details":[],"awaiting_confirmation":false,"pending_topic":null,"proposed_action":null}</innoica_voice_state>'
  );

  return lines.join('\n');
}

export function parseAndStripVoiceState(rawReply: string): ParsedVoiceStateTag {
  const regex = /<innoica_voice_state>([\s\S]*?)<\/innoica_voice_state>/i;
  const match = rawReply.match(regex);
  const cleanReply = rawReply.replace(regex, '').trim();

  if (!match?.[1]) {
    return { cleanReply, parsedState: null };
  }

  try {
    const parsed = JSON.parse(match[1].trim());
    return {
      cleanReply,
      parsedState: {
        comprehension:
          parsed.comprehension === 'sufficient' ||
          parsed.comprehension === 'partial' ||
          parsed.comprehension === 'insufficient'
            ? parsed.comprehension
            : undefined,
        validated_facts: Array.isArray(parsed.validated_facts)
          ? parsed.validated_facts.map(String).filter(Boolean).slice(0, 8)
          : undefined,
        ambiguous_points: Array.isArray(parsed.ambiguous_points)
          ? parsed.ambiguous_points.map(String).filter(Boolean).slice(0, 6)
          : undefined,
        missing_details: Array.isArray(parsed.missing_details)
          ? parsed.missing_details.map(String).filter(Boolean).slice(0, 6)
          : undefined,
        awaiting_confirmation:
          typeof parsed.awaiting_confirmation === 'boolean' ? parsed.awaiting_confirmation : undefined,
        pending_topic: typeof parsed.pending_topic === 'string' ? parsed.pending_topic : null,
        proposed_action:
          ['order', 'booking', 'payment', 'cancellation', 'profile_update'].includes(parsed.proposed_action)
            ? parsed.proposed_action
            : null,
      },
    };
  } catch {
    return { cleanReply, parsedState: null };
  }
}

export function mergeClarificationState(
  previous: ClarificationState | null | undefined,
  params: {
    sourceType: 'text' | 'audio';
    incomingText: string;
    qualityCategory?: VoiceQualityCategory | string | null;
    sensitiveIntent?: SensitiveActionType | null;
    parsedState?: ParsedVoiceStateTag['parsedState'];
  }
): ClarificationState | null {
  const prevFacts = Array.isArray(previous?.validatedFacts) ? previous!.validatedFacts : [];
  const mergedFacts = Array.from(
    new Set([...prevFacts, ...(params.parsedState?.validated_facts || [])])
  ).slice(0, 10);

  const userConfirmedExplicitly =
    Boolean(previous?.awaitingConfirmation) && CONFIRMATION_MARKERS.test(params.incomingText.trim());

  let ambiguousPoints = params.parsedState?.ambiguous_points ?? previous?.ambiguousPoints ?? [];
  let missingDetails = params.parsedState?.missing_details ?? previous?.missingDetails ?? [];
  let awaitingConfirmation =
    typeof params.parsedState?.awaiting_confirmation === 'boolean'
      ? params.parsedState.awaiting_confirmation
      : Boolean(previous?.awaitingConfirmation);

  if (params.qualityCategory === 'partial' && params.sourceType === 'audio') {
    awaitingConfirmation = true;
  }

  if (params.sensitiveIntent && (params.qualityCategory === 'partial' || missingDetails.length > 0)) {
    awaitingConfirmation = true;
  }

  if (userConfirmedExplicitly && !params.parsedState?.awaiting_confirmation) {
    awaitingConfirmation = false;
    ambiguousPoints = [];
  }

  const isCompletelyClear =
    !awaitingConfirmation &&
    ambiguousPoints.length === 0 &&
    missingDetails.length === 0 &&
    mergedFacts.length === 0;

  if (isCompletelyClear) {
    return null;
  }

  return {
    pendingTopic: params.parsedState?.pending_topic ?? previous?.pendingTopic ?? null,
    awaitingConfirmation,
    proposedAction: params.parsedState?.proposed_action ?? params.sensitiveIntent ?? previous?.proposedAction ?? null,
    validatedFacts: mergedFacts,
    ambiguousPoints,
    missingDetails,
    lastSourceType: params.sourceType,
    updatedAt: new Date().toISOString(),
  };
}

// ====================================================================
// INNOICA Agent Studio — AI Orchestrator, Free Quotas, Watermark,
// Dual-Level Memory & Atomic Human Takeover Guard
// ====================================================================

import crypto from 'node:crypto';
import { createWorkerSupabaseClient } from '@innoica/database';
import {
  AIProvider,
  applyPlanWatermark,
  ClarificationState,
  resolveOfficialAppUrl,
  resolveVoiceCapabilities,
  sanitizeKnowledgeContent,
  VoiceMessageMetadata,
} from '@innoica/shared';
import { decryptSecret } from '@innoica/shared/server';
import { dispatchLLMCall, LLMMessage } from './adapters/index.js';
import {
  buildVoiceSystemDirectives,
  decideVoicePreLlmAction,
  detectSensitiveActionIntent,
  mergeClarificationState,
  parseAndStripVoiceState,
  resolveDominantLanguage,
} from './voice-comprehension.js';

export interface VoiceAnalysisInput {
  messageId?: string;
  waMessageId?: string;
  entitlementBlocked?: boolean;
  preferredLanguage?: 'fr' | 'en' | string | null;
  voiceMetadata?: VoiceMessageMetadata;
  speechSignals?: Record<string, unknown>;
}

export interface GenerateResponseInput {
  agentId: string;
  conversationId: string;
  contactPhoneNumber: string;
  replyJid?: string;
  incomingMessage: string;
  incomingMessageType?: 'text' | 'audio';
  voiceContext?: VoiceAnalysisInput;
  idempotencyKey?: string;
}

export interface GenerateResponseOutput {
  success: boolean;
  reply?: string;
  messageId?: string;
  abortedReason?: string;
  quotaBlocked?: boolean;
  timings?: {
    totalMs: number;
    ctxMs: number;
    quotaMs: number;
    llmMs: number;
    waMs: number;
  };
}

export class AIOrchestrator {
  private supabase = createWorkerSupabaseClient();
  private whatsappWorkerUrl: string;

  constructor(whatsappWorkerUrl = process.env.WHATSAPP_WORKER_URL || 'http://localhost:4001') {
    this.whatsappWorkerUrl = whatsappWorkerUrl;
  }

  private getWorkerSecret(): string | null {
    return process.env.WORKER_INTERNAL_SECRET || null;
  }

  public async generateAndSendResponse(input: GenerateResponseInput): Promise<GenerateResponseOutput> {
    const t0 = Date.now();
    const { agentId, conversationId, contactPhoneNumber, replyJid, incomingMessage } = input;
    const workerSecret = this.getWorkerSecret();
    const idempotencyKey =
      input.idempotencyKey ||
      `req:${conversationId}:${crypto
        .createHash('sha256')
        .update(`${contactPhoneNumber}:${incomingMessage}:${Date.now()}`)
        .digest('hex')
        .slice(0, 24)}`;

    // 1. Récupérer le contexte complet via RPC sécurisée (compatible RLS)
    const tCtx0 = Date.now();
    const { data: ctx, error: ctxErr } = await this.supabase.rpc('worker_get_ai_context', {
      p_agent_id: agentId,
      p_conversation_id: conversationId,
      p_worker_secret: workerSecret,
    });
    const tCtx = Date.now() - tCtx0;

    if (ctxErr || !ctx || !ctx.ok) {
      return {
        success: false,
        abortedReason: ctxErr?.message || ctx?.error || `Impossible de charger le contexte agent ${agentId}`,
      };
    }

    const agent = ctx.agent;
    const conv = ctx.conversation;
    const cred = ctx.credential;
    const plan = ctx.plan;
    const settings = ctx.settings;

    if (!agent || (agent.status !== 'active' && agent.status !== 'connected')) {
      return { success: false, abortedReason: `Agent non actif (statut: ${agent?.status})` };
    }

    if (plan?.workspace_status === 'suspended') {
      await this.logExecution(
        agent.workspace_id,
        agentId,
        'warn',
        'workspace_suspended',
        'Réponse bloquée car le workspace est suspendu.'
      );
      return { success: false, abortedReason: 'Workspace suspendu par l’administration.' };
    }

    // 2. Vérification 1 : Mode de contrôle conversationnel (Human Takeover)
    if (!conv || conv.control_mode === 'human_takeover' || conv.control_mode === 'paused') {
      return {
        success: false,
        abortedReason: `Réponse IA bloquée : mode de conversation = ${conv?.control_mode}`,
      };
    }

    const isAudioInput = input.incomingMessageType === 'audio';
    const voiceCaps = resolveVoiceCapabilities({
      planSlug: ctx.voiceEntitlement?.planSlug || plan?.plan_slug,
      capabilities: ctx.voiceEntitlement?.capabilities,
      subscriptionStatus: plan?.subscription_status,
    });
    const hasVoiceUnderstanding =
      Boolean(ctx.voiceEntitlement?.hasVoiceUnderstanding) &&
      voiceCaps.voice_message_understanding &&
      !input.voiceContext?.entitlementBlocked;

    const activeLanguage = resolveDominantLanguage({
      detectedLanguage: input.voiceContext?.voiceMetadata?.detectedLanguage,
      preferredLanguage: input.voiceContext?.preferredLanguage || conv.preferred_language,
      agentLanguage: agent.primary_language,
      incomingText: incomingMessage,
    });

    const preDecision = isAudioInput
      ? decideVoicePreLlmAction({
          hasVoiceUnderstanding,
          qualityCategory: input.voiceContext?.voiceMetadata?.qualityCategory,
          transcript: incomingMessage,
          language: activeLanguage,
        })
      : { action: 'run_llm' as const, comprehensionStatus: 'sufficient' as const };

    // 3. Déchiffrer la clé API BYOK (requis uniquement si appel LLM nécessaire)
    let apiKey = '';
    if (preDecision.action === 'run_llm') {
      if (cred && cred.encrypted_api_key) {
        try {
          apiKey = decryptSecret(cred.encrypted_api_key);
        } catch {
          await this.logExecution(
            agent.workspace_id,
            agentId,
            'error',
            'byok_decrypt_failed',
            'Impossible de déchiffrer la clé API BYOK'
          );
          return { success: false, abortedReason: 'Erreur de déchiffrement de la clé API client' };
        }
      }

      if (!apiKey) {
        await this.logExecution(
          agent.workspace_id,
          agentId,
          'error',
          'byok_missing',
          'Aucune clé API BYOK valide configurée pour cet agent'
        );
        return { success: false, abortedReason: 'Clé API BYOK manquante' };
      }
    }

    // 4. RÉSERVATION ATOMIQUE DU QUOTA (Free: 5 nouvelles conv/j, 10 réponses/conv/j en Africa/Douala)
    const tQuota0 = Date.now();
    const { data: quotaRes, error: quotaErr } = await this.supabase.rpc('reserve_ai_reply_quota', {
      p_workspace_id: agent.workspace_id,
      p_agent_id: agentId,
      p_conversation_id: conversationId,
      p_contact_phone: contactPhoneNumber,
      p_idempotency_key: idempotencyKey,
      p_worker_secret: workerSecret,
    });
    const tQuota = Date.now() - tQuota0;

    if (quotaErr || !quotaRes) {
      await this.logExecution(
        agent.workspace_id,
        agentId,
        'error',
        'quota_check_error',
        `Erreur vérification quota serveur: ${quotaErr?.message || 'inconnue'}`
      );
      return { success: false, abortedReason: 'Erreur vérification quota serveur' };
    }

    if (!quotaRes.allowed) {
      const reason = String(quotaRes.reason || 'quota_blocked');
      await this.logExecution(
        agent.workspace_id,
        agentId,
        'warn',
        reason,
        reason === 'daily_new_conversations_quota_reached'
          ? `Quota Free atteint : ${quotaRes.usedNewConversations}/${quotaRes.maxNewConversations} nouvelles conversations aujourd'hui (${quotaRes.periodDate} Africa/Douala).`
          : `Quota Free atteint dans cette conversation : ${quotaRes.usedConvReplies}/${quotaRes.maxConvReplies} réponses IA aujourd'hui (${quotaRes.periodDate} Africa/Douala).`
      );
      return {
        success: false,
        quotaBlocked: true,
        abortedReason: reason,
      };
    }

    // 5. Génération de la réponse (statique si Free/échec vocal ou appel BYOK LLM)
    let cleanReply = preDecision.staticReply || '';
    let parsedVoiceState: ReturnType<typeof parseAndStripVoiceState>['parsedState'] = null;
    const sensitiveIntent = detectSensitiveActionIntent(incomingMessage);
    const existingClarificationState = (conv.clarification_state || null) as ClarificationState | null;
    let tLlm = 0;

    if (preDecision.action === 'run_llm') {
      let memoryContext = '';
      const contactMemories: Array<{ key: string; value: string }> = ctx.contactMemories || [];
      const convMemories: Array<{ key: string; value: string }> = ctx.conversationMemories || [];

      if (agent.is_memory_enabled && contactMemories.length > 0) {
        memoryContext +=
          `\nMémoire durable du contact :\n` +
          contactMemories.map((m) => `- ${m.key} : ${m.value}`).join('\n');
      }

      if (agent.is_memory_enabled && convMemories.length > 0) {
        memoryContext +=
          `\nMémoire contextuelle de la conversation :\n` +
          convMemories.map((m) => `- ${m.key} : ${m.value}`).join('\n');
      }

      let knowledgeContext = '';
      const chunks: Array<{
        title?: string;
        source_type?: string;
        source_url?: string | null;
        chunk_index?: number;
        content: string;
      }> = ctx.knowledgeChunks || [];

      if (chunks.length > 0) {
        knowledgeContext =
          `\n<connaissances_autorisees>\n` +
          `DOCUMENTS ET CONNAISSANCES OFFICIELLES DE L'ENTREPRISE (À UTILISER EN PRIORITÉ ABSOLUE) :\n` +
          chunks
            .map((c, i) => {
              const srcTitle = c.title || `Document ${i + 1}`;
              const srcType = (c.source_type || 'info').toUpperCase();
              const urlTag = c.source_url ? ` | Lien : ${c.source_url}` : '';
              return `[Source : "${srcTitle}" (${srcType})${urlTag}]\n${sanitizeKnowledgeContent(c.content)}`;
            })
            .join('\n\n') +
          `\n</connaissances_autorisees>\n`;
      }

      const recentMessages: Array<{
        sender_type: string;
        message_type?: string;
        voice_metadata?: VoiceMessageMetadata;
        content: string;
      }> = ctx.recentMessages || [];

      const historyMessages: LLMMessage[] = recentMessages.map((m) => {
        const prefix =
          m.message_type === 'audio' && m.sender_type === 'contact'
            ? `[Message vocal ${m.voice_metadata?.detectedLanguage || activeLanguage}] `
            : '';
        return {
          role: m.sender_type === 'contact' ? 'user' : 'assistant',
          content: `${prefix}${m.content}`,
        };
      });

      const traits = Array.isArray(agent.personality_traits)
        ? agent.personality_traits.join(', ')
        : '';

      const voiceDirectives = buildVoiceSystemDirectives({
        isVoiceInput: isAudioInput,
        language: activeLanguage,
        qualityCategory: input.voiceContext?.voiceMetadata?.qualityCategory,
        clarificationState: existingClarificationState,
        sensitiveIntent,
      });

      const systemPromptContent = `${agent.system_prompt}

Traits de personnalité : ${traits || 'Professionnel, courtois'}
Langue détectée pour cet échange : ${activeLanguage === 'en' ? 'Anglais (English)' : 'Français'}
${memoryContext}
${knowledgeContext}${voiceDirectives}
RÈGLES ET DIRECTIVES OPÉRATIONNELLES INVIOLABLES :
1. RÈGLE LINGUISTIQUE STRICTE : Tu DOIS IMPÉRATIVEMENT répondre dans la langue exacte utilisée par le client (s'il écrit ou parle en français, réponds en français ; s'il s'exprime en anglais, réponds en anglais ; s'il emploie une autre langue ou un mélange, adapte-toi fidèlement et réponds dans sa langue).
2. EXPLOITATION TOTALE DES CONNAISSANCES : Tu DOIS impérativement t'appuyer sur l'ensemble des connaissances fournies dans <connaissances_autorisees> (FAQ, fiches produits, documents TXT/PDF, sites web et liens d'entreprise). Réponds avec les informations réelles (services, tarifs, coordonnées, horaires). Si un lien web pertinent est indiqué dans les sources, fournis-le au client pour l'orienter.
3. CONCISION ET FORMAT WHATSAPP : Formule des messages courts, limpides et agréables à lire sur mobile (WhatsApp).
4. SÉCURITÉ : Ne simule jamais d'action externe ni de validation de rendez-vous ou transaction sans confirmation humaine. Si une information très spécifique est totalement absente de tes connaissances, reconnais-le poliment et propose d'orienter le client vers l'équipe.`;

      const userTurnContent = isAudioInput
        ? `[Message vocal ${activeLanguage}] ${incomingMessage}`
        : incomingMessage;

      const llmMessages: LLMMessage[] = [
        { role: 'system', content: systemPromptContent },
        ...historyMessages,
      ];

      if (
        historyMessages.length === 0 ||
        historyMessages[historyMessages.length - 1].content !== userTurnContent
      ) {
        llmMessages.push({ role: 'user', content: userTurnContent });
      }

      // 6. Appel au fournisseur IA (BYOK) ; libérer le quota réservé en cas d'échec
      let generatedReply: string;
      const tLlm0 = Date.now();
      const targetModel =
        agent.ai_provider === 'groq' &&
        (agent.ai_model === 'llama-3.3-70b-versatile' ||
          agent.ai_model === 'llama3-70b-8192' ||
          agent.ai_model === 'llama-3.1-70b-versatile')
          ? 'openai/gpt-oss-120b'
          : agent.ai_model;

      try {
        generatedReply = await dispatchLLMCall(agent.ai_provider as AIProvider, {
          apiKey,
          model: targetModel,
          temperature: Number(agent.ai_temperature) || 0.7,
          messages: llmMessages,
        });
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (agent.ai_provider === 'groq' && (msg.includes('model_not_found') || msg.includes('(404)'))) {
          try {
            generatedReply = await dispatchLLMCall('groq', {
              apiKey,
              model: 'openai/gpt-oss-120b',
              temperature: Number(agent.ai_temperature) || 0.7,
              messages: llmMessages,
            });
          } catch (fallbackErr: any) {
            await this.releaseQuota(idempotencyKey, `llm_call_failed:${fallbackErr.message}`);
            await this.logExecution(agent.workspace_id, agentId, 'error', 'llm_call_failed', fallbackErr.message);
            return { success: false, abortedReason: `Échec génération IA: ${fallbackErr.message}` };
          }
        } else {
          await this.releaseQuota(idempotencyKey, `llm_call_failed:${err.message}`);
          await this.logExecution(agent.workspace_id, agentId, 'error', 'llm_call_failed', err.message);
          return { success: false, abortedReason: `Échec génération IA: ${err.message}` };
        }
      }
      tLlm = Date.now() - tLlm0;

      const stripped = parseAndStripVoiceState(generatedReply);
      cleanReply = stripped.cleanReply || generatedReply.trim();
      parsedVoiceState = stripped.parsedState;
    }

    // 7. Application déterministe côté serveur du Watermark Free (impossible à contourner par prompt)
    const hasWatermark = Boolean(quotaRes.hasWatermark ?? plan?.has_watermark ?? true);
    const finalOutboundText = applyPlanWatermark(cleanReply, {
      hasWatermark,
      language: activeLanguage,
      templateFr: settings?.watermark_template_fr,
      templateEn: settings?.watermark_template_en,
      officialUrl: resolveOfficialAppUrl(settings?.official_domain),
    });

    // 8. DOUBLE VÉRIFICATION ATOMIQUE : Human Takeover & Quota juste avant l'envoi WhatsApp
    const { data: recheckedMode } = await this.supabase.rpc('worker_check_control_mode', {
      p_conversation_id: conversationId,
      p_worker_secret: workerSecret,
    });

    if (!recheckedMode || recheckedMode === 'human_takeover' || recheckedMode === 'paused') {
      await this.releaseQuota(idempotencyKey, 'human_takeover_intercept');
      await this.logExecution(
        agent.workspace_id,
        agentId,
        'info',
        'human_takeover_intercept',
        `Réponse IA annulée in extremis : l'opérateur humain a repris le contrôle pendant la génération.`
      );
      return {
        success: false,
        abortedReason:
          'Interception Human Takeover : la réponse générée a été annulée car un humain a repris la main.',
      };
    }

    // 9. Envoi réel sur WhatsApp via le WhatsApp Worker
    let sentMessageId: string | undefined;
    const tWa0 = Date.now();
    try {
      const sendRes = await fetch(`${this.whatsappWorkerUrl}/api/sessions/${agentId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toPhone: replyJid || contactPhoneNumber,
          text: finalOutboundText,
        }),
      });

      if (!sendRes.ok) {
        throw new Error(`WhatsApp Worker a répondu avec l'erreur: ${sendRes.statusText}`);
      }

      const sendData = await sendRes.json();
      sentMessageId = sendData.messageId;
    } catch (err: any) {
      console.error(`[AI-Runtime] Envoi WhatsApp échoué vers ${this.whatsappWorkerUrl}/api/sessions/${agentId}/send:`, err, 'Cause:', err?.cause);
      await this.releaseQuota(idempotencyKey, `wa_dispatch_failed:${err.message}`);
      await this.logExecution(agent.workspace_id, agentId, 'error', 'wa_dispatch_failed', err.message);
      return { success: false, abortedReason: `Échec d'envoi WhatsApp: ${err.message}` };
    }
    const tWa = Date.now() - tWa0;

    // 10. Confirmer atomiquement la consommation de quota & sauvegarder le message sortant
    await this.supabase.rpc('confirm_ai_reply_quota', {
      p_idempotency_key: idempotencyKey,
      p_wa_message_id: sentMessageId || null,
      p_worker_secret: workerSecret,
    });

    await this.supabase.rpc('worker_record_outbound_message', {
      p_conversation_id: conversationId,
      p_wa_message_id: sentMessageId || '',
      p_content: finalOutboundText,
      p_sender_type: 'agent',
      p_worker_secret: workerSecret,
    });

    // 11. Persister l'état de compréhension vocale, la langue et la clarification multi-tour
    const finalComprehension =
      preDecision.action === 'send_static'
        ? preDecision.comprehensionStatus
        : parsedVoiceState?.comprehension || preDecision.comprehensionStatus;

    const nextClarificationState =
      preDecision.action === 'run_llm'
        ? mergeClarificationState(existingClarificationState, {
            sourceType: isAudioInput ? 'audio' : 'text',
            incomingText: incomingMessage,
            qualityCategory: input.voiceContext?.voiceMetadata?.qualityCategory,
            sensitiveIntent,
            parsedState: parsedVoiceState,
          })
        : existingClarificationState;

    if (isAudioInput && input.voiceContext?.messageId) {
      const needsClarificationPrompt =
        finalComprehension === 'partial' || finalComprehension === 'insufficient' ? cleanReply.slice(0, 240) : null;
      await this.supabase.rpc('worker_update_voice_result', {
        p_message_id: input.voiceContext.messageId,
        p_conversation_id: conversationId,
        p_wa_message_id: input.voiceContext.waMessageId || '',
        p_workspace_id: agent.workspace_id,
        p_agent_id: agentId,
        p_content: incomingMessage || '',
        p_voice_metadata: {
          ...(input.voiceContext.voiceMetadata || {}),
          comprehensionStatus: finalComprehension,
          extractedFacts: parsedVoiceState?.validated_facts || [],
          clarificationPrompt: needsClarificationPrompt,
        },
        p_preferred_language: activeLanguage,
        p_clarification_state: nextClarificationState,
        p_job_status: !hasVoiceUnderstanding ? 'blocked_free' : preDecision.reason === 'processing_error' ? 'failed' : 'completed',
        p_worker_secret: workerSecret,
      });
    } else if (nextClarificationState !== existingClarificationState || conv.preferred_language !== activeLanguage) {
      await this.supabase.rpc('worker_set_conversation_context', {
        p_conversation_id: conversationId,
        p_preferred_language: activeLanguage,
        p_clarification_state: nextClarificationState,
        p_worker_secret: workerSecret,
      });
    }

    // 12. Enrichissement mémoire contact/conversation non bloquant
    if (agent.is_memory_enabled && conv.contact_id && incomingMessage.trim()) {
      this.extractLightweightMemories(conv.contact_id, conversationId, incomingMessage, cleanReply).catch(
        () => {}
      );
    }

    const totalTime = Date.now() - t0;
    console.info(
      `[AI-Runtime] Réponse envoyée en ${totalTime}ms (ctx: ${tCtx}ms, quota: ${tQuota}ms, llm: ${tLlm}ms) agent=${agentId} conv=${conversationId} type=${isAudioInput ? 'audio' : 'text'} lang=${activeLanguage} plan=${quotaRes.planSlug} watermark=${hasWatermark} msgId=${sentMessageId}`
    );

    return {
      success: true,
      reply: finalOutboundText,
      messageId: sentMessageId,
      timings: {
        totalMs: totalTime,
        ctxMs: tCtx,
        quotaMs: tQuota,
        llmMs: tLlm,
        waMs: tWa,
      },
    };
  }

  private async releaseQuota(idempotencyKey: string, reason: string) {
    try {
      await this.supabase.rpc('release_ai_reply_quota', {
        p_idempotency_key: idempotencyKey,
        p_reason: reason.slice(0, 200),
        p_worker_secret: this.getWorkerSecret(),
      });
    } catch (err) {
      console.error('[AI-Runtime] Erreur libération quota:', err);
    }
  }

  private async extractLightweightMemories(
    contactId: string,
    conversationId: string,
    incomingMessage: string,
    generatedReply: string
  ) {
    const contactItems: Array<{ key: string; value: string }> = [];
    const convItems: Array<{ key: string; value: string }> = [];

    const nameMatch = incomingMessage.match(
      /(?:je m'appelle|moi c'est|my name is)\s+([A-ZÀ-ÿa-z'-]{2,30}(?:\s+[A-ZÀ-ÿa-z'-]{2,30})?)/i
    );
    if (nameMatch?.[1]) {
      contactItems.push({ key: 'nom_declare', value: nameMatch[1].trim() });
    }

    const emailMatch = incomingMessage.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (emailMatch?.[0]) {
      contactItems.push({ key: 'email', value: emailMatch[0].toLowerCase() });
    }

    convItems.push({
      key: 'dernier_sujet',
      value: incomingMessage.slice(0, 140).trim(),
    });
    convItems.push({
      key: 'derniere_reponse_ia',
      value: generatedReply.slice(0, 140).trim(),
    });

    await this.supabase.rpc('worker_upsert_memories', {
      p_contact_id: contactId,
      p_conversation_id: conversationId,
      p_contact_items: contactItems,
      p_conversation_items: convItems,
      p_worker_secret: this.getWorkerSecret(),
    });
  }

  private async logExecution(
    workspaceId: string,
    agentId: string,
    level: 'info' | 'warn' | 'error',
    eventType: string,
    message: string
  ) {
    const logMsg = `[AI-Runtime] [${level.toUpperCase()}] [${eventType}] agent=${agentId}: ${message}`;
    if (level === 'error') console.error(logMsg);
    else if (level === 'warn') console.warn(logMsg);
    else console.info(logMsg);

    try {
      await this.supabase.rpc('worker_log_execution', {
        p_workspace_id: workspaceId,
        p_agent_id: agentId,
        p_level: level,
        p_event_type: eventType,
        p_message: message,
        p_details: {},
        p_worker_secret: this.getWorkerSecret(),
      });
    } catch (err) {
      console.error('[AI-Runtime] Erreur logging execution:', err);
    }
  }
}

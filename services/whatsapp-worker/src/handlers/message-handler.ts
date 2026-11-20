// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Message Handler
// Traitement des messages entrants, déduplication et contrôle d'état
// ====================================================================

import { proto } from '@whiskeysockets/baileys';
import { createWorkerSupabaseClient } from '@innoica/database';
import { normalizePhoneNumberForBaileys, type VoiceMessageMetadata, type ImageMessageMetadata } from '@innoica/shared';
import {
  extractAudioDescriptor,
  inspectAudioMagicBytes,
  MAX_VOICE_BYTES,
  requestSpeechTranscription,
  unwrapProtoMessage,
  validateAudioMetadataBeforeDownload,
} from './audio-handler.js';
import {
  extractImageDescriptor,
  inspectImageMagicBytes,
  MAX_IMAGE_BYTES,
  validateImageMetadataBeforeDownload,
  type IncomingImageDescriptor,
} from './image-handler.js';

export type MediaDownloader = (agentId: string, msg: proto.IWebMessageInfo) => Promise<Buffer>;

export interface MessageHandlerOptions {
  speechWorkerEndpoint?: string;
  mediaDownloader?: MediaDownloader;
  presenceSender?: (agentId: string, toJid: string, presence: 'composing' | 'paused' | 'recording') => Promise<void>;
}

export class WhatsAppMessageHandler {
  private supabase = createWorkerSupabaseClient();
  private aiRuntimeEndpoint: string;
  private speechWorkerEndpoint: string;
  private mediaDownloader?: MediaDownloader;
  private presenceSender?: (agentId: string, toJid: string, presence: 'composing' | 'paused' | 'recording') => Promise<void>;

  constructor(
    aiRuntimeEndpoint = process.env.AI_RUNTIME_URL || 'http://localhost:4002',
    options?: MessageHandlerOptions
  ) {
    this.aiRuntimeEndpoint = aiRuntimeEndpoint;
    this.speechWorkerEndpoint =
      options?.speechWorkerEndpoint || process.env.SPEECH_WORKER_URL || 'http://localhost:4004';
    this.mediaDownloader = options?.mediaDownloader;
    this.presenceSender = options?.presenceSender;
  }

  private extractMessageText(message: proto.IMessage | null | undefined): string {
    const unwrapped = unwrapProtoMessage(message);
    if (!unwrapped) return '';

    return (
      unwrapped.conversation ||
      unwrapped.extendedTextMessage?.text ||
      unwrapped.videoMessage?.caption ||
      unwrapped.documentMessage?.caption ||
      unwrapped.buttonsResponseMessage?.selectedDisplayText ||
      unwrapped.listResponseMessage?.title ||
      unwrapped.templateButtonReplyMessage?.selectedDisplayText ||
      ''
    );
  }

  private async logExecutionError(
    agentId: string,
    workspaceId: string | undefined,
    eventType: string,
    message: string,
    details: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      let resolvedWorkspaceId = workspaceId;
      if (!resolvedWorkspaceId && agentId) {
        const { data: agent } = await this.supabase
          .from('agents')
          .select('workspace_id')
          .eq('id', agentId)
          .single();
        resolvedWorkspaceId = agent?.workspace_id;
      }
      if (!resolvedWorkspaceId) {
        console.error(`[Message-Handler] Impossible de logger l'exécution: workspaceId introuvable pour agent=${agentId}`);
        return;
      }
      await this.supabase.rpc('worker_log_execution', {
        p_workspace_id: resolvedWorkspaceId,
        p_agent_id: agentId,
        p_level: 'error',
        p_event_type: eventType,
        p_message: message,
        p_details: details,
        p_worker_secret: process.env.WORKER_INTERNAL_SECRET || null,
      });
    } catch (logErr) {
      console.error('[Message-Handler] Échec du logging execution_logs:', logErr);
    }
  }

  private async dispatchToAiRuntime(payload: Record<string, unknown>, workspaceId?: string): Promise<void> {
    const agentId = String(payload.agentId || '');
    try {
      const response = await fetch(`${this.aiRuntimeEndpoint}/api/generate-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000),
      });

      if (!response.ok) {
        const errorMsg = `AI Runtime HTTP ${response.status}: ${response.statusText}`;
        console.error(`[Message-Handler] ${errorMsg}`);
        await this.logExecutionError(agentId, workspaceId, 'ai_dispatch_failed', errorMsg, {
          status: response.status,
          statusText: response.statusText,
          conversationId: payload.conversationId,
        });
      }
    } catch (err: any) {
      const errorMsg = `Erreur de communication avec AI Runtime: ${err?.message || String(err)}`;
      console.error(`[Message-Handler] ${errorMsg}`);
      await this.logExecutionError(agentId, workspaceId, 'ai_dispatch_failed', errorMsg, {
        error: err?.message || String(err),
        conversationId: payload.conversationId,
      });
    }
  }

  private async dispatchAutomation(params: {
    workspaceId: string;
    agentId: string;
    triggerType: string;
    payload: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<{ executionsCount: number; hasWaitingWorkflow: boolean }> {
    try {
      const res = await fetch(`${this.aiRuntimeEndpoint}/api/automation/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: params.workspaceId,
          agentId: params.agentId,
          triggerType: params.triggerType,
          payload: params.payload,
          idempotencyKey: params.idempotencyKey,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const executions = (data?.executions || []) as Array<{ status: string }>;
      const hasWaitingWorkflow = executions.some((e) => e.status === 'waiting');
      return {
        executionsCount: Number(data?.executionsCount || 0),
        hasWaitingWorkflow,
      };
    } catch (err) {
      console.error('[Message-Handler] Erreur dispatch automation:', err);
      return { executionsCount: 0, hasWaitingWorkflow: false };
    }
  }

  public async handleIncomingMessage(agentId: string, msg: proto.IWebMessageInfo): Promise<void> {
    const rawJid = msg.key?.remoteJid;
    if (!rawJid || !msg.message) return;

    // 1. Filtrage et routage spécifique pour les Groupes WhatsApp (@g.us)
    if (rawJid.endsWith('@g.us')) {
      await this.handleIncomingGroupMessage(agentId, rawJid, msg);
      return;
    }

    // 2. Filtrage des chaînes (@newsletter)
    if (rawJid.endsWith('@newsletter')) {
      return;
    }

    const altJid = (msg.key as any)?.remoteJidAlt as string | undefined;

    // Normalisation de altJid s'il s'agit d'un JID ou d'un numéro brut
    let normalizedAlt: string | undefined;
    if (altJid) {
      const cleanAltDigits = altJid.replace(/@.*$/, '').replace(/:\d+$/, '').replace(/\D/g, '');
      if (cleanAltDigits) {
        normalizedAlt = `${cleanAltDigits}@s.whatsapp.net`;
      }
    }

    // Détermination du JID effectif et du numéro de contact (+237...)
    const effectiveJid = (normalizedAlt && normalizedAlt.endsWith('@s.whatsapp.net'))
      ? normalizedAlt
      : (rawJid.endsWith('@s.whatsapp.net') ? rawJid : undefined);

    const rawSenderNumber = effectiveJid
      ? effectiveJid.replace(/@.*$/, '').replace(/:\d+$/, '').replace(/\D/g, '')
      : rawJid.replace(/@.*$/, '').replace(/:\d+$/, '').replace(/\D/g, '');
    const contactPhoneNumber = `+${rawSenderNumber}`;
    const waMessageId = msg.key?.id || '';

    // DESTINATION WHATSAPP CRITIQUE : Toujours répondre et envoyer la présence au JID exact
    // d'où provient le message (rawJid). Si le contact écrit depuis un chat LID (@lid),
    // la réponse et l'indicateur "en train d'écrire..." doivent impérativement être envoyés au @lid
    // pour s'afficher dans son fil de discussion actif sur son téléphone !
    const destinationJid = rawJid;

    // Indiquer immédiatement en temps réel que le bot écrit ('composing') dans le chat actif
    if (this.presenceSender && destinationJid) {
      this.presenceSender(agentId, destinationJid, 'composing').catch(() => {});
    }

    const imageDescriptor = extractImageDescriptor(msg.message);
    if (imageDescriptor) {
      try {
        await this.handleIncomingImageMessage({
          agentId,
          rawJid: destinationJid,
          contactPhoneNumber,
          pushName: msg.pushName || '',
          waMessageId,
          imageDescriptor,
          msg,
        });
      } finally {
        if (this.presenceSender && destinationJid) {
          this.presenceSender(agentId, destinationJid, 'paused').catch(() => {});
        }
      }
      return;
    }

    const textContent = this.extractMessageText(msg.message);
    if (textContent.trim()) {
      // 1. Vérifier si ce message réveille un workflow en attente (wait_for_message)
      try {
        const checkRes = await fetch(`${this.aiRuntimeEndpoint}/api/automation/check-waiting`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            senderPhone: contactPhoneNumber,
            messageText: textContent,
          }),
        });
        const checkData = (await checkRes.json().catch(() => ({}))) as Record<string, unknown>;
        if (Number(checkData?.resumedCount || 0) > 0) {
          if (this.presenceSender && destinationJid) {
            this.presenceSender(agentId, destinationJid, 'paused').catch(() => {});
          }
          return;
        }
      } catch {
        // Non-bloquant
      }

      try {
        await this.handleIncomingTextMessage({
          agentId,
          rawJid: destinationJid,
          contactPhoneNumber,
          pushName: msg.pushName || '',
          waMessageId,
          textContent,
        });
      } finally {
        if (this.presenceSender && destinationJid) {
          this.presenceSender(agentId, destinationJid, 'paused').catch(() => {});
        }
      }
      return;
    }

    const audioDescriptor = extractAudioDescriptor(msg.message);
    if (!audioDescriptor) {
      if (this.presenceSender && destinationJid) {
        this.presenceSender(agentId, destinationJid, 'paused').catch(() => {});
      }
      const unwrappedKeys = Object.keys(unwrapProtoMessage(msg.message) || {});
      console.info(
        `[Message-Handler] Message non-texte/non-audio/non-image ignoré de ${rawJid} keys=[${unwrappedKeys.join(',')}]`
      );
      return;
    }

    try {
      await this.handleIncomingAudioMessage({
        agentId,
        msg,
        rawJid: destinationJid,
        contactPhoneNumber,
        pushName: msg.pushName || '',
        waMessageId,
        audioDescriptor,
      });
    } finally {
      if (this.presenceSender && destinationJid) {
        this.presenceSender(agentId, destinationJid, 'paused').catch(() => {});
      }
    }
  }

  private async handleIncomingTextMessage(params: {
    agentId: string;
    rawJid: string;
    contactPhoneNumber: string;
    pushName: string;
    waMessageId: string;
    textContent: string;
  }): Promise<void> {
    const { data: ingestRes, error: ingestErr } = await this.supabase.rpc('worker_ingest_inbound_message', {
      p_agent_id: params.agentId,
      p_contact_phone: params.contactPhoneNumber,
      p_push_name: params.pushName,
      p_wa_message_id: params.waMessageId,
      p_content: params.textContent,
      p_worker_secret: process.env.WORKER_INTERNAL_SECRET || null,
    });

    if (ingestErr || !ingestRes) {
      console.error('[Message-Handler] Erreur ingestion message entrant:', ingestErr);
      return;
    }
    if (!ingestRes.ok) {
      console.info(`[Message-Handler] Message ignoré (${ingestRes.reason}) pour agent ${params.agentId}`);
      return;
    }

    const { agentStatus, conversationId, controlMode, messageId, workspaceId } = ingestRes as {
      ok: boolean;
      agentStatus: string;
      conversationId: string;
      controlMode: 'ai_active' | 'human_takeover' | 'paused';
      messageId: string;
      workspaceId?: string;
    };

    if (agentStatus !== 'active' && agentStatus !== 'connected') {
      console.info(`[Message-Handler] Agent ${params.agentId} inactif (statut: ${agentStatus}).`);
      return;
    }
    if (controlMode === 'human_takeover' || controlMode === 'paused') {
      console.info(`[Message-Handler] Conversation ${conversationId} en mode ${controlMode}. L'IA ne répond pas.`);
      return;
    }

    const idempotencyKey = params.waMessageId ? `wa:${params.agentId}:${params.waMessageId}` : `msg:${messageId}`;

    let handledByWaitingAutomation = false;
    if (workspaceId) {
      const autoRes = await this.dispatchAutomation({
        workspaceId,
        agentId: params.agentId,
        triggerType: 'wa_private_message_received',
        payload: {
          contact: { phone: params.contactPhoneNumber, name: params.pushName },
          message: { text: params.textContent, id: params.waMessageId },
          contactPhoneNumber: params.contactPhoneNumber,
          conversationId,
        },
        idempotencyKey: `auto:${idempotencyKey}`,
      });

      if (autoRes.hasWaitingWorkflow) {
        handledByWaitingAutomation = true;
      }
    }

    if (!handledByWaitingAutomation) {
      await this.dispatchToAiRuntime(
        {
          agentId: params.agentId,
          conversationId,
          contactPhoneNumber: params.contactPhoneNumber,
          replyJid: params.rawJid,
          incomingMessage: params.textContent,
          incomingMessageType: 'text',
          idempotencyKey,
        },
        workspaceId
      );
    }
  }

  private async handleIncomingImageMessage(params: {
    agentId: string;
    rawJid: string;
    contactPhoneNumber: string;
    pushName: string;
    waMessageId: string;
    imageDescriptor: IncomingImageDescriptor;
    msg: proto.IWebMessageInfo;
  }): Promise<void> {
    const captionText = (params.imageDescriptor.caption || '').trim();
    const placeholderContent = captionText ? `[Photo] ${captionText}` : '[Photo]';
    const initialMeta: ImageMessageMetadata = {
      mimeType: params.imageDescriptor.mimeType,
      fileSizeBytes: params.imageDescriptor.fileSizeBytes,
      caption: params.imageDescriptor.caption,
      processingStatus: 'completed',
    };

    const { data: ingestRes, error: ingestErr } = await this.supabase.rpc('worker_ingest_inbound_message', {
      p_agent_id: params.agentId,
      p_contact_phone: params.contactPhoneNumber,
      p_push_name: params.pushName,
      p_wa_message_id: params.waMessageId,
      p_content: placeholderContent,
      p_worker_secret: process.env.WORKER_INTERNAL_SECRET || null,
      p_message_type: 'image',
      p_image_metadata: initialMeta,
    });

    if (ingestErr || !ingestRes) {
      console.error('[Message-Handler] Erreur ingestion message image:', ingestErr);
      return;
    }
    if (!ingestRes.ok) {
      console.info(`[Message-Handler] Image ignorée (${ingestRes.reason}) pour agent ${params.agentId}`);
      return;
    }

    const { agentStatus, conversationId, controlMode, messageId, workspaceId } = ingestRes as {
      ok: boolean;
      agentStatus: string;
      conversationId: string;
      controlMode: 'ai_active' | 'human_takeover' | 'paused';
      messageId: string;
      workspaceId?: string;
    };

    if (agentStatus !== 'active' && agentStatus !== 'connected') {
      console.info(`[Message-Handler] Agent ${params.agentId} inactif (statut: ${agentStatus}).`);
      return;
    }
    if (controlMode === 'human_takeover' || controlMode === 'paused') {
      console.info(`[Message-Handler] Conversation ${conversationId} en mode ${controlMode}. Image non traitée par l'IA.`);
      return;
    }

    const idempotencyKey = params.waMessageId ? `wa:${params.agentId}:${params.waMessageId}` : `msg:${messageId}`;

    if (!this.mediaDownloader) {
      console.error('[Message-Handler] mediaDownloader indisponible pour télécharger l\'image.');
      return;
    }

    let imageBuffer: Buffer | null = null;
    try {
      const preCheck = validateImageMetadataBeforeDownload(params.imageDescriptor);
      if (!preCheck.valid) {
        console.warn(`[Message-Handler] Métadonnées image invalides: ${preCheck.errorCode}`);
        await this.dispatchToAiRuntime(
          {
            agentId: params.agentId,
            conversationId,
            contactPhoneNumber: params.contactPhoneNumber,
            replyJid: params.rawJid,
            incomingMessage: params.imageDescriptor.caption || '',
            incomingMessageType: 'image',
            imageContext: {
              mimeType: params.imageDescriptor.mimeType || 'image/jpeg',
              isCorrupted: true,
              caption: params.imageDescriptor.caption || undefined,
            },
            idempotencyKey,
          },
          workspaceId
        );
        return;
      }

      imageBuffer = await this.mediaDownloader(params.agentId, params.msg);
      if (!imageBuffer || imageBuffer.length === 0 || imageBuffer.length > MAX_IMAGE_BYTES) {
        console.warn('[Message-Handler] Image téléchargée vide ou trop volumineuse');
        await this.dispatchToAiRuntime(
          {
            agentId: params.agentId,
            conversationId,
            contactPhoneNumber: params.contactPhoneNumber,
            replyJid: params.rawJid,
            incomingMessage: params.imageDescriptor.caption || '',
            incomingMessageType: 'image',
            imageContext: {
              mimeType: params.imageDescriptor.mimeType || 'image/jpeg',
              isCorrupted: true,
              caption: params.imageDescriptor.caption || undefined,
            },
            idempotencyKey,
          },
          workspaceId
        );
        return;
      }

      const detectedFormat = inspectImageMagicBytes(imageBuffer);
      if (!detectedFormat) {
        console.warn('[Message-Handler] Format image corrompu ou magic bytes non reconnus');
        await this.dispatchToAiRuntime(
          {
            agentId: params.agentId,
            conversationId,
            contactPhoneNumber: params.contactPhoneNumber,
            replyJid: params.rawJid,
            incomingMessage: params.imageDescriptor.caption || '',
            incomingMessageType: 'image',
            imageContext: {
              mimeType: params.imageDescriptor.mimeType || 'image/jpeg',
              isCorrupted: true,
              caption: params.imageDescriptor.caption || undefined,
            },
            idempotencyKey,
          },
          workspaceId
        );
        return;
      }

      const mimeType = detectedFormat === 'jpeg' ? 'image/jpeg' : detectedFormat === 'png' ? 'image/png' : 'image/webp';
      const base64Data = imageBuffer.toString('base64');

      await this.dispatchToAiRuntime(
        {
          agentId: params.agentId,
          conversationId,
          contactPhoneNumber: params.contactPhoneNumber,
          replyJid: params.rawJid,
          incomingMessage: params.imageDescriptor.caption || '',
          incomingMessageType: 'image',
          imageContext: {
            mimeType,
            base64Data,
            caption: params.imageDescriptor.caption || undefined,
          },
          idempotencyKey,
        },
        workspaceId
      );
    } catch (imgErr: any) {
      console.error('[Message-Handler] Échec du téléchargement/traitement de l\'image:', imgErr);
      await this.dispatchToAiRuntime(
        {
          agentId: params.agentId,
          conversationId,
          contactPhoneNumber: params.contactPhoneNumber,
          replyJid: params.rawJid,
          incomingMessage: params.imageDescriptor.caption || '',
          incomingMessageType: 'image',
          imageContext: {
            mimeType: params.imageDescriptor.mimeType || 'image/jpeg',
            isCorrupted: true,
            caption: params.imageDescriptor.caption || undefined,
          },
          idempotencyKey,
        },
        workspaceId
      );
    } finally {
      if (imageBuffer) {
        imageBuffer.fill(0);
        imageBuffer = null;
      }
    }
  }

  private async handleIncomingAudioMessage(params: {
    agentId: string;
    msg: proto.IWebMessageInfo;
    rawJid: string;
    contactPhoneNumber: string;
    pushName: string;
    waMessageId: string;
    audioDescriptor: NonNullable<ReturnType<typeof extractAudioDescriptor>>;
  }): Promise<void> {
    const initialMeta: VoiceMessageMetadata = {
      durationSeconds: params.audioDescriptor.durationSeconds,
      mimeType: params.audioDescriptor.mimeType,
      fileSizeBytes: params.audioDescriptor.fileSizeBytes,
      isVoiceNote: params.audioDescriptor.isVoiceNote,
      processingStatus: 'queued',
    };

    const placeholderContent = params.audioDescriptor.durationSeconds
      ? `[Message vocal - ${params.audioDescriptor.durationSeconds}s]`
      : '[Message vocal]';

    // 1. Ingestion + contrôle serveur strict des droits d'abonnement AVANT tout téléchargement
    const { data: ingestRes, error: ingestErr } = await this.supabase.rpc('worker_ingest_audio_message', {
      p_agent_id: params.agentId,
      p_contact_phone: params.contactPhoneNumber,
      p_push_name: params.pushName,
      p_wa_message_id: params.waMessageId,
      p_content: placeholderContent,
      p_voice_metadata: initialMeta,
      p_worker_secret: process.env.WORKER_INTERNAL_SECRET || null,
    });

    if (ingestErr || !ingestRes) {
      console.error('[Message-Handler] Erreur ingestion message audio:', ingestErr);
      return;
    }
    if (!ingestRes.ok) {
      console.info(`[Message-Handler] Audio ignoré (${ingestRes.reason}) pour agent ${params.agentId}`);
      return;
    }

    const {
      workspaceId,
      agentStatus,
      agentLanguage,
      hasVoiceUnderstanding,
      conversationId,
      controlMode,
      preferredLanguage,
      messageId,
    } = ingestRes as {
      ok: boolean;
      workspaceId: string;
      agentStatus: string;
      agentLanguage?: 'fr' | 'en';
      hasVoiceUnderstanding: boolean;
      conversationId: string;
      controlMode: 'ai_active' | 'human_takeover' | 'paused';
      preferredLanguage?: 'fr' | 'en' | null;
      messageId: string;
    };

    if (agentStatus !== 'active' && agentStatus !== 'connected') {
      console.info(`[Message-Handler] Agent ${params.agentId} inactif (statut: ${agentStatus}). Audio non traité.`);
      return;
    }
    if (controlMode === 'human_takeover' || controlMode === 'paused') {
      console.info(`[Message-Handler] Conversation ${conversationId} en mode ${controlMode}. Audio non téléchargé.`);
      return;
    }

    const idempotencyKey = params.waMessageId ? `wa:${params.agentId}:${params.waMessageId}` : `msg:${messageId}`;

    // 2. RÈGLE COMMERCIALE ABSOLUE : Free => aucun téléchargement audio, aucun appel Whisper, réponse texte stricte
    if (!hasVoiceUnderstanding) {
      console.info(`[Message-Handler] Vocal bloqué sur plan Free (conv=${conversationId}). Aucun média téléchargé.`);
      await this.dispatchToAiRuntime(
        {
          agentId: params.agentId,
          conversationId,
          contactPhoneNumber: params.contactPhoneNumber,
          replyJid: params.rawJid,
          incomingMessage: '',
          incomingMessageType: 'audio',
          idempotencyKey,
          voiceContext: {
            messageId,
            waMessageId: params.waMessageId,
            entitlementBlocked: true,
            preferredLanguage: preferredLanguage || agentLanguage || 'fr',
            voiceMetadata: {
              ...initialMeta,
              processingStatus: 'blocked_free',
              comprehensionStatus: 'insufficient',
              blockedReason: 'free_plan',
            },
          },
        },
        workspaceId
      );
      return;
    }

    // 3. Plan payant actif : validation métadonnées avant téléchargement
    const preCheck = validateAudioMetadataBeforeDownload(params.audioDescriptor);
    if (!preCheck.valid) {
      const failMeta: VoiceMessageMetadata = {
        ...initialMeta,
        processingStatus: 'failed',
        qualityCategory: 'unsupported',
        comprehensionStatus: 'insufficient',
        blockedReason: 'unsupported',
        errorCode: preCheck.errorCode,
      };
      await this.persistVoiceFailure(workspaceId, params.agentId, conversationId, messageId, params.waMessageId, failMeta, preCheck.errorCode);
      await this.dispatchToAiRuntime(
        {
          agentId: params.agentId,
          conversationId,
          contactPhoneNumber: params.contactPhoneNumber,
          replyJid: params.rawJid,
          incomingMessage: '',
          incomingMessageType: 'audio',
          idempotencyKey,
          voiceContext: {
            messageId,
            waMessageId: params.waMessageId,
            entitlementBlocked: false,
            preferredLanguage: preferredLanguage || agentLanguage || 'fr',
            voiceMetadata: failMeta,
          },
        },
        workspaceId
      );
      return;
    }

    if (!this.mediaDownloader) {
      console.error('[Message-Handler] mediaDownloader indisponible pour télécharger le vocal.');
      return;
    }

    // 4. Téléchargement en mémoire uniquement + nettoyage garanti dans finally
    let audioBuffer: Buffer | null = null;
    try {
      audioBuffer = await this.mediaDownloader(params.agentId, params.msg);
      if (!audioBuffer || audioBuffer.length === 0 || audioBuffer.length > MAX_VOICE_BYTES || !inspectAudioMagicBytes(audioBuffer)) {
        const invalidMeta: VoiceMessageMetadata = {
          ...initialMeta,
          fileSizeBytes: audioBuffer ? audioBuffer.length : 0,
          processingStatus: 'failed',
          qualityCategory: 'unsupported',
          comprehensionStatus: 'insufficient',
          blockedReason: 'unsupported',
          errorCode: 'invalid_or_corrupted_audio',
        };
        await this.persistVoiceFailure(workspaceId, params.agentId, conversationId, messageId, params.waMessageId, invalidMeta, 'invalid_or_corrupted_audio');
        await this.dispatchToAiRuntime(
          {
            agentId: params.agentId,
            conversationId,
            contactPhoneNumber: params.contactPhoneNumber,
            replyJid: params.rawJid,
            incomingMessage: '',
            incomingMessageType: 'audio',
            idempotencyKey,
            voiceContext: {
              messageId,
              waMessageId: params.waMessageId,
              entitlementBlocked: false,
              preferredLanguage: preferredLanguage || agentLanguage || 'fr',
              voiceMetadata: invalidMeta,
            },
          },
          workspaceId
        );
        return;
      }

      const speechRes = await requestSpeechTranscription({
        speechWorkerEndpoint: this.speechWorkerEndpoint,
        audioBuffer,
        claimedMime: params.audioDescriptor.mimeType,
        correlationId: messageId,
      });

      const resolvedLang =
        speechRes.detectedLanguage === 'fr' || speechRes.detectedLanguage === 'en'
          ? speechRes.detectedLanguage
          : preferredLanguage || agentLanguage || 'fr';

      const updatedMeta: VoiceMessageMetadata = {
        ...initialMeta,
        durationSeconds: speechRes.durationSeconds || initialMeta.durationSeconds,
        fileSizeBytes: audioBuffer.length,
        detectedLanguage: speechRes.detectedLanguage,
        transcript: speechRes.transcript || '',
        qualityCategory: speechRes.qualityCategory,
        processingStatus: speechRes.ok ? 'completed' : 'failed',
        processingMs: speechRes.processingMs || null,
        errorCode: speechRes.errorCode || null,
      };

      const persistedContent =
        speechRes.transcript && speechRes.transcript.trim()
          ? speechRes.transcript.trim()
          : placeholderContent;

      await this.supabase.rpc('worker_update_voice_result', {
        p_message_id: messageId,
        p_conversation_id: conversationId,
        p_wa_message_id: params.waMessageId,
        p_workspace_id: workspaceId,
        p_agent_id: params.agentId,
        p_content: persistedContent,
        p_voice_metadata: updatedMeta,
        p_preferred_language: resolvedLang,
        p_job_status: speechRes.ok ? 'completed' : 'failed',
        p_processing_ms: speechRes.processingMs || null,
        p_error_code: speechRes.errorCode || null,
        p_worker_secret: process.env.WORKER_INTERNAL_SECRET || null,
      });

      await this.dispatchToAiRuntime(
        {
          agentId: params.agentId,
          conversationId,
          contactPhoneNumber: params.contactPhoneNumber,
          replyJid: params.rawJid,
          incomingMessage: speechRes.transcript || '',
          incomingMessageType: 'audio',
          idempotencyKey,
          voiceContext: {
            messageId,
            waMessageId: params.waMessageId,
            entitlementBlocked: false,
            preferredLanguage: resolvedLang,
            voiceMetadata: updatedMeta,
            speechSignals: {
              languageProbability: speechRes.languageProbability,
              avgLogprob: speechRes.avgLogprob ?? null,
              noSpeechProb: speechRes.noSpeechProb ?? null,
              speechRatio: speechRes.speechRatio ?? null,
            },
          },
        },
        workspaceId
      );
    } catch (err) {
      const errCode = err instanceof Error ? err.message.slice(0, 80) : 'audio_processing_error';
      console.error(`[Message-Handler] Échec traitement vocal (msg=${messageId}):`, errCode);
      const errMeta: VoiceMessageMetadata = {
        ...initialMeta,
        processingStatus: 'failed',
        qualityCategory: 'processing_error',
        comprehensionStatus: 'insufficient',
        blockedReason: 'processing_error',
        errorCode: 'speech_processing_error',
      };
      await this.persistVoiceFailure(workspaceId, params.agentId, conversationId, messageId, params.waMessageId, errMeta, 'speech_processing_error');
      await this.dispatchToAiRuntime(
        {
          agentId: params.agentId,
          conversationId,
          contactPhoneNumber: params.contactPhoneNumber,
          replyJid: params.rawJid,
          incomingMessage: '',
          incomingMessageType: 'audio',
          idempotencyKey,
          voiceContext: {
            messageId,
            waMessageId: params.waMessageId,
            entitlementBlocked: false,
            preferredLanguage: preferredLanguage || agentLanguage || 'fr',
            voiceMetadata: errMeta,
          },
        },
        workspaceId
      );
    } finally {
      if (audioBuffer) {
        audioBuffer.fill(0);
        audioBuffer = null;
      }
    }
  }

  private async persistVoiceFailure(
    workspaceId: string,
    agentId: string,
    conversationId: string,
    messageId: string,
    waMessageId: string,
    meta: VoiceMessageMetadata,
    errorCode: string
  ): Promise<void> {
    await this.supabase.rpc('worker_update_voice_result', {
      p_message_id: messageId,
      p_conversation_id: conversationId,
      p_wa_message_id: waMessageId,
      p_workspace_id: workspaceId,
      p_agent_id: agentId,
      p_content: '',
      p_voice_metadata: meta,
      p_job_status: 'failed',
      p_error_code: errorCode,
      p_worker_secret: process.env.WORKER_INTERNAL_SECRET || null,
    });
  }

  /**
   * Traitement sécurisé des messages reçus dans un Groupe WhatsApp (@g.us)
   */
  private async handleIncomingGroupMessage(
    agentId: string,
    groupJid: string,
    msg: proto.IWebMessageInfo
  ): Promise<void> {
    // 1. Vérifier si le groupe est explicitement activé pour cet agent
    const { data: config } = await this.supabase
      .from('whatsapp_group_configs')
      .select('*')
      .eq('agent_id', agentId)
      .eq('group_jid', groupJid)
      .eq('is_active', true)
      .maybeSingle();

    if (!config) {
      // Aucun groupe non explicitement activé par l'utilisateur n'est surveillé
      return;
    }

    const textContent = this.extractMessageText(msg.message);
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const participantJid = (msg.key?.participant || (msg as any)?.participant || '') as string;
    const cleanDigits = participantJid.replace(/@.*$/, '').replace(/:\d+$/, '').replace(/\D/g, '');
    const participantPhone = `+${cleanDigits}`;

    // 2. Vérifier les participants autorisés si une liste blanche est configurée
    if (config.allowed_participants && config.allowed_participants.length > 0) {
      const isAllowed = config.allowed_participants.some(
        (p: string) => p === participantPhone || p === participantJid
      );
      if (!isAllowed) return;
    }

    // 3. Vérifier le mode de surveillance (mentions_only, keywords_only, all_messages)
    let shouldRespond = false;
    let triggerType = 'wa_group_message_received';

    if (config.monitor_mode === 'all_messages') {
      shouldRespond = true;
    } else if (config.monitor_mode === 'keywords_only') {
      const matched = (config.keywords || []).some((kw: string) =>
        textContent.toLowerCase().includes(kw.toLowerCase())
      );
      if (matched) {
        shouldRespond = true;
        triggerType = 'wa_group_keyword_matched';
      }
    } else {
      // Par défaut : mentions_only
      const isMentioned = mentions.length > 0 || textContent.includes('@');
      if (isMentioned) {
        shouldRespond = true;
        triggerType = 'wa_group_bot_mentioned';
      }
    }

    if (!shouldRespond) return;

    // Déclencher le moteur d'automatisation
    try {
      await fetch(`${this.aiRuntimeEndpoint}/api/automation/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: config.workspace_id,
          agentId,
          triggerType,
          payload: {
            group: { jid: groupJid, name: config.group_name },
            sender: { phone: participantPhone, jid: participantJid, pushName: msg.pushName },
            message: { text: textContent, id: msg.key?.id },
          },
        }),
      });
    } catch (err) {
      console.error('[WA-Worker] Erreur dispatch automation groupe:', err);
    }
  }
}

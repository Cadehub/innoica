// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Message Handler
// Traitement des messages entrants, déduplication et contrôle d'état
// ====================================================================

import { proto } from '@whiskeysockets/baileys';
import { createWorkerSupabaseClient } from '@innoica/database';

export class WhatsAppMessageHandler {
  private supabase = createWorkerSupabaseClient();
  private aiRuntimeEndpoint: string;

  constructor(aiRuntimeEndpoint = process.env.AI_RUNTIME_URL || 'http://localhost:4002') {
    this.aiRuntimeEndpoint = aiRuntimeEndpoint;
  }

  public async handleIncomingMessage(agentId: string, msg: proto.IWebMessageInfo): Promise<void> {
    const rawJid = msg.key.remoteJid;
    if (!rawJid || !msg.message) return;

    // Normaliser le numéro d'expéditeur (+237...)
    const rawSenderNumber = rawJid.split('@')[0];
    const contactPhoneNumber = `+${rawSenderNumber}`;

    // Extraire le texte du message
    const textContent =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      '';

    if (!textContent.trim()) {
      return; // Ignore les messages sans texte dans le MVP
    }

    const waMessageId = msg.key.id;

    // 1. Récupérer l'agent et son workspace
    const { data: agent, error: agentErr } = await this.supabase
      .from('agents')
      .select('id, workspace_id, status, is_memory_enabled, primary_language')
      .eq('id', agentId)
      .single();

    if (agentErr || !agent) {
      console.error(`[Message-Handler] Agent introuvable (${agentId})`);
      return;
    }

    // 2. Déduplication par ID WhatsApp
    if (waMessageId) {
      const { data: existingMsg } = await this.supabase
        .from('messages')
        .select('id')
        .eq('wa_message_id', waMessageId)
        .maybeSingle();

      if (existingMsg) {
        console.info(`[Message-Handler] Message dupliqué ignoré (ID: ${waMessageId})`);
        return;
      }
    }

    // 3. Trouver ou créer le contact
    let contactId: string;
    const { data: existingContact } = await this.supabase
      .from('contacts')
      .select('id')
      .eq('workspace_id', agent.workspace_id)
      .eq('phone_number', contactPhoneNumber)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;
    } else {
      const { data: newContact, error: contactErr } = await this.supabase
        .from('contacts')
        .insert({
          workspace_id: agent.workspace_id,
          phone_number: contactPhoneNumber,
          display_name: msg.pushName || null,
        })
        .select('id')
        .single();

      if (contactErr || !newContact) {
        console.error('[Message-Handler] Erreur création contact:', contactErr);
        return;
      }
      contactId = newContact.id;
    }

    // 4. Trouver ou créer la conversation
    let conversationId: string;
    let controlMode: 'ai_active' | 'human_takeover' | 'paused' = 'ai_active';

    const { data: existingConv } = await this.supabase
      .from('conversations')
      .select('id, control_mode')
      .eq('agent_id', agentId)
      .eq('contact_id', contactId)
      .maybeSingle();

    if (existingConv) {
      conversationId = existingConv.id;
      controlMode = existingConv.control_mode as any;
    } else {
      const { data: newConv, error: convErr } = await this.supabase
        .from('conversations')
        .insert({
          agent_id: agentId,
          contact_id: contactId,
          control_mode: 'ai_active',
          last_message_at: new Date().toISOString(),
          unread_count: 1,
        })
        .select('id, control_mode')
        .single();

      if (convErr || !newConv) {
        console.error('[Message-Handler] Erreur création conversation:', convErr);
        return;
      }
      conversationId = newConv.id;
      controlMode = 'ai_active';
    }

    // 5. Enregistrer le message entrant
    const { error: msgErr } = await this.supabase.from('messages').insert({
      conversation_id: conversationId,
      wa_message_id: waMessageId,
      sender_type: 'contact',
      content: textContent,
      delivery_status: 'received',
      created_at: new Date().toISOString(),
    });

    if (msgErr) {
      console.error('[Message-Handler] Erreur insertion message entrant:', msgErr);
      return;
    }

    // Mettre à jour la date du dernier message dans la conversation
    await this.supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    // 6. Vérifier l'état opérationnel de l'agent
    if (agent.status !== 'active') {
      console.info(`[Message-Handler] Agent ${agentId} n'est pas actif (statut: ${agent.status}). Aucune réponse automatique.`);
      return;
    }

    // 7. Vérifier le mode de contrôle humain (Human Takeover)
    if (controlMode === 'human_takeover' || controlMode === 'paused') {
      console.info(`[Message-Handler] Conversation ${conversationId} est en mode ${controlMode}. L'IA ne répond pas.`);
      return;
    }

    // 8. Transmettre au service AI Runtime pour génération de réponse
    try {
      const response = await fetch(`${this.aiRuntimeEndpoint}/api/generate-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          conversationId,
          contactPhoneNumber,
          incomingMessage: textContent,
        }),
      });

      if (!response.ok) {
        console.error(`[Message-Handler] AI Runtime a retourné une erreur: ${response.statusText}`);
      }
    } catch (err) {
      console.error('[Message-Handler] Erreur de communication avec AI Runtime:', err);
    }
  }
}

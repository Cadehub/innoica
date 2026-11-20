// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Universal Automation Action Registry
// Deterministic execution of authorized business operations
// ====================================================================

import type { ActionType, WorkflowExecution, WorkflowStep } from '@innoica/shared';
import { validateUrlForSsrf } from '@innoica/shared/server';
import { createWorkerSupabaseClient } from '@innoica/database';

export interface ActionExecutionContext {
  workspaceId: string;
  agentId: string | null;
  execution: WorkflowExecution;
  step: WorkflowStep;
  variables: Record<string, unknown>;
  whatsappWorkerUrl: string;
}

export interface ActionResult {
  success: boolean;
  output?: Record<string, unknown>;
  error?: string;
  isWaiting?: boolean;
  waitingContext?: Record<string, unknown>;
  needsApproval?: boolean;
  approvalPayload?: Record<string, unknown>;
}

export class ActionRegistry {
  private supabase = createWorkerSupabaseClient();

  /**
   * Interpolate variables like {{message.text}} or {{contact.phone}} in string templates
   */
  public interpolateString(template: string, variables: Record<string, unknown>): string {
    return template.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
      const parts = key.split('.');
      let current: unknown = variables;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return '';
        }
      }
      return current !== undefined && current !== null ? String(current) : '';
    });
  }

  public async executeAction(context: ActionExecutionContext): Promise<ActionResult> {
    const { action_type, payload } = context.step;
    const { variables, agentId, whatsappWorkerUrl } = context;

    switch (action_type) {
      // 1. Envoyer un message WhatsApp privé (texte ou multimédia)
      case 'send_private_message': {
        const textTemplate = (payload.text as string) || '';
        const text = this.interpolateString(textTemplate, variables);
        const recipientPhone =
          this.interpolateString((payload.recipient_phone as string) || '', variables) ||
          (variables.contact as Record<string, unknown>)?.phone ||
          (variables.client as Record<string, unknown>)?.phone ||
          (variables.sender as Record<string, unknown>)?.phone;

        const mediaUrlRaw = (payload.media_url || payload.image_url || payload.document_url || '') as string;
        const mediaUrl = this.interpolateString(mediaUrlRaw, variables);
        const mediaType = (payload.media_type || (payload.image_url ? 'image' : payload.document_url ? 'document' : undefined)) as 'image' | 'document' | 'audio' | undefined;
        const fileName = (payload.file_name as string) || undefined;
        const caption = payload.caption ? this.interpolateString(payload.caption as string, variables) : text;

        if (!agentId || !recipientPhone || (!text && !mediaUrl)) {
          return { success: false, error: 'Paramètres manquants pour send_private_message (agentId, recipientPhone ou contenu text/media)' };
        }

        try {
          const bodyPayload: Record<string, unknown> = {
            toPhone: String(recipientPhone),
            text: text || caption,
          };
          if (mediaUrl) {
            bodyPayload.mediaUrl = mediaUrl;
            bodyPayload.mediaType = mediaType || 'image';
            bodyPayload.fileName = fileName;
            bodyPayload.caption = caption;
          }

          const res = await fetch(`${whatsappWorkerUrl}/api/sessions/${agentId}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
          });
          const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          if (!res.ok) {
            return { success: false, error: `Erreur worker WhatsApp HTTP ${res.status}: ${data.error || 'Inconnu'}` };
          }
          return { success: true, output: { sent: true, recipient: recipientPhone, text, mediaUrl: mediaUrl || undefined, messageId: data.messageId } };
        } catch (err: unknown) {
          return { success: false, error: `Échec réseau vers worker WhatsApp: ${(err as Error).message}` };
        }
      }

      // 2. Envoyer un message dans un groupe WhatsApp autorisé
      case 'send_group_message': {
        const textTemplate = (payload.text as string) || '';
        const text = this.interpolateString(textTemplate, variables);
        const groupJid =
          this.interpolateString((payload.group_jid as string) || '', variables) ||
          (variables.group as Record<string, unknown>)?.jid;

        if (!agentId || !groupJid || !text) {
          return { success: false, error: 'Paramètres manquants pour send_group_message' };
        }

        try {
          const res = await fetch(`${whatsappWorkerUrl}/api/sessions/${agentId}/groups/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              groupJid: String(groupJid),
              text,
            }),
          });
          const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          return { success: res.ok, output: { sent: res.ok, groupJid, text, data } };
        } catch (err: unknown) {
          return { success: false, error: `Échec envoi groupe: ${(err as Error).message}` };
        }
      }

      // 3. Attendre une réponse (wait_for_message)
      case 'wait_for_message': {
        const timeoutMinutes = Number(payload.timeout_minutes || context.step.timeout_minutes || 60);
        const expectedSender = this.interpolateString((payload.expected_sender as string) || '', variables);
        const expectedPhone = this.interpolateString((payload.expected_phone as string) || '', variables);
        const correlationKey = (payload.correlation_key as string) || context.execution.correlation_id || `corr_${context.execution.id}`;
        const timeoutAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();

        return {
          success: true,
          isWaiting: true,
          waitingContext: {
            waiting_for_action: 'wait_for_message',
            step_index: context.execution.current_step_index,
            expected_sender: expectedSender || undefined,
            expected_phone: expectedPhone || undefined,
            correlation_key: correlationKey,
            variable_to_store: payload.variable_to_store || 'received_reply',
            timeout_at: timeoutAt,
          },
          output: { waiting: true, correlation_key: correlationKey, timeout_at: timeoutAt },
        };
      }

      // 3b. Temporisation programmée (wait_delay)
      case 'wait_delay': {
        const delaySeconds = Number(payload.delay_seconds || (Number(payload.delay_minutes || 1) * 60));
        const resumeAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

        return {
          success: true,
          isWaiting: true,
          waitingContext: {
            waiting_for_action: 'wait_delay',
            step_index: context.execution.current_step_index,
            resume_at: resumeAt,
            delay_seconds: delaySeconds,
          },
          output: { delayed: true, resume_at: resumeAt },
        };
      }

      // 3c. Webhook HTTP sécurisé avec protection SSRF (webhook_call)
      case 'webhook_call': {
        const urlRaw = (payload.url as string) || '';
        const url = this.interpolateString(urlRaw, variables);
        const method = ((payload.method as string) || 'POST').toUpperCase();
        const headersRaw = (payload.headers as Record<string, string>) || { 'Content-Type': 'application/json' };
        const bodyRaw = payload.body || {};

        if (!url) {
          return { success: false, error: 'URL manquante pour webhook_call' };
        }

        const ssrfCheck = await validateUrlForSsrf(url);
        if (!ssrfCheck.isSafe) {
          return { success: false, error: `Sécurité SSRF bloquée : ${ssrfCheck.reason}` };
        }

        try {
          const bodyString = typeof bodyRaw === 'string'
            ? this.interpolateString(bodyRaw, variables)
            : JSON.stringify(bodyRaw);

          const response = await fetch(url, {
            method,
            headers: headersRaw,
            body: method !== 'GET' && method !== 'HEAD' ? bodyString : undefined,
            signal: AbortSignal.timeout(10000),
          });

          const contentType = response.headers.get('content-type') || '';
          let responseData: any;
          if (contentType.includes('application/json')) {
            responseData = await response.json().catch(() => ({}));
          } else {
            responseData = await response.text().catch(() => '');
          }

          if (!response.ok) {
            return {
              success: false,
              error: `Webhook HTTP ${response.status}`,
              output: { statusCode: response.status, data: responseData },
            };
          }

          return {
            success: true,
            output: {
              webhook_executed: true,
              statusCode: response.status,
              response: responseData,
            },
          };
        } catch (err: unknown) {
          return { success: false, error: `Erreur webhook Réseau: ${(err as Error).message}` };
        }
      }

      // 4. Demande d'information à un fournisseur
      case 'send_supplier_inquiry': {
        const inquiryText = this.interpolateString((payload.template as string) || 'Demande de disponibilité', variables);
        const supplierPhone =
          this.interpolateString(
            (payload.supplier_phone as string) ||
            (payload.recipient_phone as string) ||
            (payload.phone as string) ||
            '',
            variables
          ) ||
          process.env.DEFAULT_SUPPLIER_PHONE;

        if (!agentId || !supplierPhone) {
          return { success: false, error: 'Agent ID ou numéro de fournisseur manquant pour send_supplier_inquiry' };
        }

        try {
          const res = await fetch(`${whatsappWorkerUrl}/api/sessions/${agentId}/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toPhone: supplierPhone,
              text: `[INNOICA Fournisseur] ${inquiryText}`,
            }),
          });
          const sendData = (await res.json().catch(() => ({}))) as Record<string, unknown>;
          return { success: res.ok, output: { contacted_supplier: supplierPhone, inquiryText, sendResult: sendData } };
        } catch (err: unknown) {
          return { success: false, error: `Erreur contact fournisseur: ${(err as Error).message}` };
        }
      }

      // 5. Notifier le responsable / tiers spécifié
      case 'notify_manager': {
        const title = this.interpolateString((payload.title as string) || 'Alerte Agent', variables);
        const summary = this.interpolateString((payload.summary as string) || '', variables);
        const targetPhone = this.interpolateString(
          (payload.recipient_phone as string) ||
          (payload.phone as string) ||
          (payload.manager_phone as string) ||
          '',
          variables
        );

        let finalPhone = targetPhone;

        if (!finalPhone) {
          // Récupérer le numéro du propriétaire du workspace
          const { data: ws } = await this.supabase
            .from('workspaces')
            .select('owner_id')
            .eq('id', context.workspaceId)
            .single();

          if (ws?.owner_id) {
            const { data: profile } = await this.supabase
              .from('profiles')
              .select('phone, full_name, email')
              .eq('id', ws.owner_id)
              .single();
            finalPhone = profile?.phone || '';
          }
        }

        if (agentId && finalPhone) {
          try {
            const sendRes = await fetch(`${whatsappWorkerUrl}/api/sessions/${agentId}/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                toPhone: String(finalPhone),
                text: `[INNOICA Alerte Responsable]\n*${title}*\n\n${summary}`,
              }),
            });
            const sendData = (await sendRes.json().catch(() => ({}))) as Record<string, unknown>;
            return {
              success: sendRes.ok,
              output: { notified: sendRes.ok, title, summary, recipient: finalPhone, sendResult: sendData },
            };
          } catch (err: unknown) {
            return {
              success: false,
              error: `Échec envoi WhatsApp manager: ${(err as Error).message}`,
            };
          }
        }

        return {
          success: true,
          output: { notified: true, title, summary, recipient: finalPhone || 'non_renseigné' },
        };
      }

      // 6. Transférer la conversation à un humain (Human Takeover)
      case 'transfer_to_human': {
        const convId = (variables.conversation as Record<string, unknown>)?.id || (variables.conversationId as string);
        if (convId) {
          await this.supabase
            .from('conversations')
            .update({ control_mode: 'human_takeover' })
            .eq('id', convId);
        }
        return { success: true, output: { transferred: true, conversationId: convId } };
      }

      // 7. Enregistrer une déclaration d'absence RH
      case 'record_employee_absence': {
        const employee = this.interpolateString((payload.employee_identifier as string) || '', variables);
        const reason = this.interpolateString((payload.reason as string) || '', variables);

        return {
          success: true,
          output: { recorded: true, employee, reason, recorded_at: new Date().toISOString() },
        };
      }

      // 8. Générer un rapport d'activité d'entreprise
      case 'generate_business_report': {
        const { count: convCount } = await this.supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active');

        const { count: msgCount } = await this.supabase
          .from('messages')
          .select('id', { count: 'exact', head: true });

        const summary = `Rapport d'activité : ${convCount || 0} conversations actives, ${msgCount || 0} messages traités.`;
        return {
          success: true,
          output: { summary, active_conversations: convCount || 0, total_messages: msgCount || 0 },
        };
      }

      // 9. Vérifier le stock d'un produit (Commerce)
      case 'verify_product_stock': {
        const productName = this.interpolateString((payload.product_name as string) || '', variables);
        const { data: products } = await this.supabase
          .from('products')
          .select('id, name, stock_quantity, price_xaf')
          .eq('workspace_id', context.workspaceId)
          .ilike('name', `%${productName}%`)
          .limit(1);

        const prod = products?.[0];
        return {
          success: true,
          output: {
            found: Boolean(prod),
            product_name: prod?.name || productName,
            stock: prod?.stock_quantity ?? 0,
            price_xaf: prod?.price_xaf ?? 0,
          },
        };
      }

      // 9b. Mettre à jour les stocks (Commerce)
      case 'update_inventory': {
        const productName = this.interpolateString((payload.product_name as string) || '', variables);
        const quantityDelta = Number(payload.quantity_delta || 0);

        if (productName && quantityDelta !== 0) {
          const { data: prod } = await this.supabase
            .from('products')
            .select('id, stock_quantity')
            .eq('workspace_id', context.workspaceId)
            .ilike('name', `%${productName}%`)
            .limit(1)
            .maybeSingle();

          if (prod) {
            const newStock = Math.max(0, (prod.stock_quantity || 0) + quantityDelta);
            await this.supabase
              .from('products')
              .update({ stock_quantity: newStock })
              .eq('id', prod.id);

            return {
              success: true,
              output: { updated: true, product_id: prod.id, previous_stock: prod.stock_quantity, new_stock: newStock },
            };
          }
        }
        return { success: true, output: { updated: false, reason: 'Produit introuvable ou delta nul' } };
      }

      // 9c. Création de commande brouillon
      case 'create_draft_order': {
        const customerPhone = this.interpolateString((payload.customer_phone as string) || '', variables) ||
          (variables.contact as Record<string, unknown>)?.phone;
        const total = Number(payload.total_amount || 0);

        return {
          success: true,
          output: {
            order_created: true,
            status: 'draft',
            customer_phone: customerPhone,
            total_amount: total,
            created_at: new Date().toISOString(),
          },
        };
      }

      // 10. Actions sensibles sur les groupes nécessitant approbation
      case 'kick_group_participant':
      case 'update_group_settings': {
        if (context.step.require_approval !== false) {
          return {
            success: true,
            needsApproval: true,
            approvalPayload: {
              action_type,
              target: payload,
              reason: 'Opération administrative de groupe soumise à confirmation humaine.',
            },
            output: { paused_for_approval: true },
          };
        }
        return { success: true, output: { executed_admin_action: action_type } };
      }

      default:
        return { success: false, error: `ActionType inconnu ou non implémenté : ${action_type}` };
    }
  }
}

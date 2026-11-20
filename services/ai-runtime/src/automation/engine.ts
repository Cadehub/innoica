// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Universal Automation Engine & Executor
// Manages deterministic workflow execution, wait_for_message, and approvals
// ====================================================================

import {
  ActionType,
  TriggerType,
  WorkflowCondition,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStep,
} from '@innoica/shared';
import { createWorkerSupabaseClient } from '@innoica/database';
import { ActionRegistry } from './action-registry.js';

// Detecteur strict d'intention pour éviter les faux déclenchements intempestifs
export function detectInboundMessageIntent(
  rawText: string
): 'product_availability' | 'absence_report' | 'complaint' | 'greeting' | 'general' {
  const text = (rawText || '').trim().toLowerCase();
  if (!text) return 'general';

  // 1. Détection de mécontentement ou réclamation explicite
  const isComplaint =
    /(?:m[ée]content|insatisfait|arnaque|escroc|voleur|inacceptable|remboursez|remboursement|plainte|service pourri|d[ée]çu|scandaleux)/i.test(
      text
    );
  if (isComplaint) {
    return 'complaint';
  }

  // 2. Détection d'absence / RH
  const isAbsence =
    /(?:absent|absence|malade|maladie|cong[ée]|retard|empêchement|empechement|ne pourrai(?:s)? pas venir|ne viens pas|pas venir au travail|arriverai en retard)/i.test(
      text
    );
  if (isAbsence) {
    return 'absence_report';
  }

  // 3. Détection de demande de produit / disponibilité / stock / prix
  // Doit comporter des signaux d'intention explicites d'achat, de disponibilité ou de tarification
  const hasAvailabilityKeywords =
    /(?:disponible|disponibilit[ée]|en stock|rupture(?: de stock)?|reste[- ]t[- ]il|avez[- ]vous du stock|vous avez du stock)/i.test(
      text
    );
  const hasPriceKeywords =
    /(?:combien (?:coute|coûte|ça coute|ça coûte|c['’]est)|quel est le prix|le prix de|prix du|tarif de|c['’]est à combien)/i.test(
      text
    );
  const hasCatalogOrPurchase =
    /(?:avez[- ]vous (?:un|une|des|le|la|les|ce|cette|du|de la|\d+)|vous avez (?:un|une|des|le|la|les|ce|cette|du|de la|\d+)|je cherche (?:un|une|des|le|la|les|ce|cette|du|de la)|je voudrais commander|je veux commander|je souhaite commander|je veux acheter|je souhaite acheter|je voudrais acheter|acheter (?:un|une|des|le|la|les|ce|cette)|commander (?:un|une|des|le|la|les|ce|cette)|vendez[- ]vous|catalogue des)/i.test(
      text
    );
  const isDirectProductKeyword =
    /^(?:disponible\??|en stock\??|le prix\??|combien\??|catalogue\??)$/i.test(text);

  if (hasAvailabilityKeywords || hasPriceKeywords || hasCatalogOrPurchase || isDirectProductKeyword) {
    return 'product_availability';
  }

  // 4. Salutations et politesses pures (si aucune intention produit/absence/plainte n'a matché)
  const greetingTokensRemoved = text
    .replace(
      /(?:merci beaucoup|bonne journ[ée]e|bonne soir[ée]e|comment (?:vas[- ]tu|tu vas|allez[- ]vous|vous allez)|à bientôt|a bientot|au revoir|bien reçu|c['’]est qui|qui est[- ]ce|d['’]?accord|bonjour|bonsoir|salut|hello|hi|hey|coucou|yo|merci|ok|daccord|dac|not[ée]|super|parfait|ça va|ca va|bye|a\+?|à plus)/gi,
      ''
    )
    .replace(/[\s.!,?-]/g, '');

  if (greetingTokensRemoved.length === 0) {
    return 'greeting';
  }

  return 'general';
}

export class AutomationEngine {
  private supabase = createWorkerSupabaseClient();
  private actionRegistry = new ActionRegistry();
  private whatsappWorkerUrl: string;

  constructor(whatsappWorkerUrl = process.env.WHATSAPP_WORKER_URL || 'http://localhost:4001') {
    this.whatsappWorkerUrl = whatsappWorkerUrl;
  }

  /**
   * Evaluate a condition deterministically against execution variables
   */
  public evaluateCondition(condition: WorkflowCondition, variables: Record<string, unknown>): boolean {
    const parts = condition.field.split('.');
    let val: unknown = variables;
    for (const part of parts) {
      if (val && typeof val === 'object' && part in (val as Record<string, unknown>)) {
        val = (val as Record<string, unknown>)[part];
      } else {
        val = undefined;
        break;
      }
    }

    const target = condition.value;

    // Déduction intelligente de l'intention s'il s'agit d'un message brut sans métadonnées
    if (condition.field === 'message.intent' && (val === undefined || val === null || val === '')) {
      const msgText = String(
        (variables.message as Record<string, unknown>)?.text ||
        (variables.trigger as Record<string, unknown>)?.messageText ||
        ''
      );
      val = detectInboundMessageIntent(msgText);
    } else if (condition.field === 'message.sentiment' && (val === undefined || val === null || val === '')) {
      const msgText = String((variables.message as Record<string, unknown>)?.text || '').toLowerCase();
      if (/(?:m[ée]content|insatisfait|colère|colere|remboursement|plainte|d[ée]çu|nul|mauvais|incompétent)/i.test(msgText)) {
        val = 'negative';
      } else {
        val = 'neutral';
      }
    }

    switch (condition.operator) {
      case 'equals':
        return String(val) === String(target);
      case 'not_equals':
        return String(val) !== String(target);
      case 'contains':
        return String(val || '').toLowerCase().includes(String(target || '').toLowerCase());
      case 'not_contains':
        return !String(val || '').toLowerCase().includes(String(target || '').toLowerCase());
      case 'matches_regex':
        try {
          return new RegExp(String(target), 'i').test(String(val || ''));
        } catch {
          return false;
        }
      case 'greater_than':
        return Number(val) > Number(target);
      case 'less_than':
        return Number(val) < Number(target);
      case 'is_empty':
        return val === undefined || val === null || val === '';
      case 'is_not_empty':
        return val !== undefined && val !== null && val !== '';
      case 'in_list':
        return Array.isArray(target) && target.includes(val);
      default:
        return false;
    }
  }

  /**
   * Evaluates all conditions of a workflow. All conditions must pass (AND logic).
   */
  public evaluateAllConditions(conditions: WorkflowCondition[], variables: Record<string, unknown>): boolean {
    if (!conditions || conditions.length === 0) return true;
    for (const cond of conditions) {
      if (!this.evaluateCondition(cond, variables)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Dispatches an event and triggers all matching active workflows
   */
  public async dispatchEvent(
    workspaceId: string,
    agentId: string | null,
    triggerType: TriggerType,
    payload: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<WorkflowExecution[]> {
    // 0. Vérifier d'abord si ce message entrant résout un workflow en attente (ex: réponse du fournisseur)
    const senderPhone = String(
      (payload.contact as Record<string, unknown>)?.phone ||
      payload.contactPhoneNumber ||
      (payload.sender as Record<string, unknown>)?.phone ||
      ''
    );
    const messageText = String(
      (payload.message as Record<string, unknown>)?.text ||
      payload.messageText ||
      payload.textContent ||
      ''
    );

    if (agentId && senderPhone && (triggerType === 'wa_private_message_received' || triggerType === 'wa_group_message_received')) {
      const resumedCount = await this.checkAndResumeWaitingWorkflows(agentId, senderPhone, messageText);
      if (resumedCount > 0) {
        // Le message a été consommé par une exécution en attente qui a repris. Ne pas redéclencher un nouveau workflow.
        return [];
      }
    }

    // 1. Récupérer les workflows actifs correspondant à ce déclencheur
    const { data: workflows, error } = await this.supabase
      .from('workflow_definitions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('trigger_type', triggerType)
      .eq('status', 'active');

    if (error || !workflows || workflows.length === 0) {
      return [];
    }

    const initiatedExecutions: WorkflowExecution[] = [];

    for (const wf of workflows) {
      // Filtrer par agent si le workflow est spécifique à un agent
      if (wf.agent_id && agentId && wf.agent_id !== agentId) {
        continue;
      }

      const contactObj = (payload.contact as Record<string, unknown>) || {
        phone: payload.contactPhoneNumber || (payload.sender as Record<string, unknown>)?.phone,
        name: payload.contactName || (payload.sender as Record<string, unknown>)?.pushName,
      };

      const messageObj = (payload.message as Record<string, unknown>) || {
        text: payload.messageText || payload.textContent || (typeof payload === 'string' ? payload : ''),
        id: payload.messageId || payload.waMessageId || '',
      };

      const initialVariables: Record<string, unknown> = {
        trigger: payload,
        message: messageObj,
        contact: contactObj,
        client: contactObj, // Alias accessible via {{client.phone}} et {{client.name}}
        group: payload.group || null,
        workspaceId,
        agentId,
      };

      // Vérifier les conditions initiales du workflow
      if (!this.evaluateAllConditions(wf.conditions || [], initialVariables)) {
        continue;
      }

      // Créer l'exécution dans Supabase
      const runIdempotencyKey = idempotencyKey ? `${idempotencyKey}:${wf.id}` : undefined;
      const { data: execution, error: execErr } = await this.supabase
        .from('workflow_executions')
        .insert({
          workspace_id: workspaceId,
          workflow_id: wf.id,
          agent_id: agentId || wf.agent_id,
          trigger_event: triggerType,
          trigger_payload: payload,
          idempotency_key: runIdempotencyKey,
          status: 'running',
          current_step_index: 0,
          variables: initialVariables,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (execErr || !execution) {
        continue;
      }

      // Exécuter immédiatement les étapes du workflow
      await this.runExecutionSteps(execution as WorkflowExecution, wf as WorkflowDefinition);
      initiatedExecutions.push(execution as WorkflowExecution);
    }

    return initiatedExecutions;
  }

  /**
   * Executes the steps of a workflow sequentially or following DAG branching
   */
  public async runExecutionSteps(
    execution: WorkflowExecution,
    workflow: WorkflowDefinition
  ): Promise<void> {
    const steps = workflow.steps || [];
    let currentIndex = execution.current_step_index || 0;
    const variables = { ...execution.variables };
    let executionCycles = 0;
    const MAX_CYCLES = 50; // Protection anti-boucle infinie

    while (currentIndex >= 0 && currentIndex < steps.length) {
      executionCycles++;
      if (executionCycles > MAX_CYCLES) {
        await this.supabase
          .from('workflow_executions')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_details: { error: 'Dépassement du quota maximal d’étapes (boucle infinie détectée)' },
          })
          .eq('id', execution.id);
        return;
      }

      const step = steps[currentIndex];
      const t0 = Date.now();

      // Log début étape
      const { data: stepLog } = await this.supabase
        .from('workflow_execution_logs')
        .insert({
          execution_id: execution.id,
          step_index: currentIndex,
          action_type: step.action_type,
          status: 'started',
          input_payload: step.payload,
        })
        .select('id')
        .single();

      // Exécuter l'action via le Registry
      const result = await this.actionRegistry.executeAction({
        workspaceId: execution.workspace_id,
        agentId: execution.agent_id,
        execution,
        step,
        variables,
        whatsappWorkerUrl: this.whatsappWorkerUrl,
      });

      const durationMs = Date.now() - t0;

      // Cas 1 : L'action attend une réponse asynchrone (wait_for_message ou wait_delay)
      if (result.isWaiting && result.waitingContext) {
        const expectedPhone =
          (result.waitingContext.expected_phone as string) ||
          (result.waitingContext.expected_sender as string) ||
          null;
        const correlationKey =
          (result.waitingContext.correlation_key as string) ||
          execution.correlation_id ||
          `corr_${execution.id}`;

        await this.supabase
          .from('workflow_execution_logs')
          .update({
            status: 'waiting',
            output_payload: result.output,
            duration_ms: durationMs,
          })
          .eq('id', stepLog?.id);

        await this.supabase
          .from('workflow_executions')
          .update({
            status: 'waiting',
            current_step_index: currentIndex,
            waiting_context: result.waitingContext,
            expected_sender_phone: expectedPhone,
            correlation_id: correlationKey,
            variables,
          })
          .eq('id', execution.id);

        return; // Le workflow est en pause, sortie sécurisée
      }

      // Cas 2 : L'action nécessite une approbation humaine
      if (result.needsApproval) {
        await this.supabase.from('workflow_approvals').insert({
          workspace_id: execution.workspace_id,
          execution_id: execution.id,
          step_index: currentIndex,
          action_type: step.action_type,
          title: `Approbation requise : ${step.name}`,
          description: `Action sensible soumise à confirmation humaine`,
          payload: result.approvalPayload || {},
          status: 'pending',
        });

        await this.supabase
          .from('workflow_executions')
          .update({
            status: 'needs_approval',
            current_step_index: currentIndex,
            variables,
          })
          .eq('id', execution.id);

        return;
      }

      // Cas 3 : Échec de l'étape
      if (!result.success) {
        await this.supabase
          .from('workflow_execution_logs')
          .update({
            status: 'failed',
            error_message: result.error,
            duration_ms: durationMs,
          })
          .eq('id', stepLog?.id);

        if (step.on_error === 'continue') {
          currentIndex++;
          continue;
        }

        await this.supabase
          .from('workflow_executions')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_details: { step_index: currentIndex, error: result.error },
          })
          .eq('id', execution.id);
        return;
      }

      // Cas 4 : Succès de l'étape
      if (result.output) {
        Object.assign(variables, result.output);
      }

      await this.supabase
        .from('workflow_execution_logs')
        .update({
          status: 'succeeded',
          output_payload: result.output,
          duration_ms: durationMs,
        })
        .eq('id', stepLog?.id);

      // Résolution du DAG : Vérifier les branches conditionnelles puis le next_step_id
      let nextStepId: string | undefined;
      const branches = (step as any).branches as Array<{ condition?: WorkflowCondition; next_step_id: string }> | undefined;
      if (branches && branches.length > 0) {
        for (const branch of branches) {
          if (!branch.condition || this.evaluateCondition(branch.condition, variables)) {
            nextStepId = branch.next_step_id;
            break;
          }
        }
      }

      if (!nextStepId && step.next_step_id) {
        nextStepId = step.next_step_id;
      }

      if (nextStepId) {
        const nextIdx = steps.findIndex((s) => s.id === nextStepId);
        if (nextIdx !== -1) {
          currentIndex = nextIdx;
        } else {
          // Si le step ID ciblé n'existe pas, arrêt du DAG
          break;
        }
      } else {
        currentIndex++;
      }
    }

    // Toutes les étapes ont été complétées avec succès
    await this.supabase
      .from('workflow_executions')
      .update({
        status: 'succeeded',
        current_step_index: currentIndex,
        completed_at: new Date().toISOString(),
        variables,
      })
      .eq('id', execution.id);
  }

  /**
   * Resumes an execution that was in 'waiting' state when the expected message arrives
   */
  public async resumeWaitingExecution(
    executionId: string,
    replyPayload: Record<string, unknown>
  ): Promise<boolean> {
    const { data: execution } = await this.supabase
      .from('workflow_executions')
      .select('*, workflow:workflow_definitions(*)')
      .eq('id', executionId)
      .eq('status', 'waiting')
      .single();

    if (!execution || !execution.workflow) return false;

    // Récupérer la variable attendue et injecter la réponse reçue
    const waitCtx = execution.waiting_context as Record<string, unknown>;
    const varName = (waitCtx?.variable_to_store as string) || 'received_reply';
    const updatedVariables = {
      ...execution.variables,
      [varName]: replyPayload,
    };

    // Déterminer la prochaine étape du workflow (DAG)
    const workflow = execution.workflow as WorkflowDefinition;
    const currentStep = workflow.steps?.[execution.current_step_index];
    let nextIndex = execution.current_step_index + 1;
    if (currentStep?.next_step_id) {
      const idx = workflow.steps.findIndex((s) => s.id === currentStep.next_step_id);
      if (idx !== -1) {
        nextIndex = idx;
      }
    }

    execution.current_step_index = nextIndex;
    execution.status = 'running';
    execution.variables = updatedVariables;
    execution.waiting_context = null;

    await this.supabase
      .from('workflow_executions')
      .update({
        status: 'running',
        current_step_index: nextIndex,
        waiting_context: null,
        variables: updatedVariables,
      })
      .eq('id', executionId);

    // Reprendre la suite du workflow
    await this.runExecutionSteps(execution as WorkflowExecution, execution.workflow as WorkflowDefinition);
    return true;
  }

  /**
   * Checks if an incoming message matches any active workflow in 'waiting' status
   */
  public async checkAndResumeWaitingWorkflows(
    agentId: string,
    senderPhone: string,
    messageText: string,
    correlationId?: string
  ): Promise<number> {
    const { data: waitingExecs } = await this.supabase
      .from('workflow_executions')
      .select('id, waiting_context, correlation_id, expected_sender_phone')
      .eq('status', 'waiting')
      .eq('agent_id', agentId);

    if (!waitingExecs || waitingExecs.length === 0) return 0;

    let resumedCount = 0;
    const cleanSender = senderPhone.replace(/\D/g, '');

    for (const exec of waitingExecs) {
      const waitCtx = exec.waiting_context as Record<string, unknown> | null;
      if (!waitCtx) continue;

      // 1. Correspondance par correlationId explicite
      if (correlationId && (exec.correlation_id === correlationId || waitCtx.correlation_key === correlationId)) {
        const resumed = await this.resumeWaitingExecution(exec.id, {
          text: messageText,
          sender: senderPhone,
          correlation_id: correlationId,
          received_at: new Date().toISOString(),
        });
        if (resumed) resumedCount++;
        continue;
      }

      // 2. Correspondance par numéro de téléphone
      const expPhone = String(exec.expected_sender_phone || waitCtx.expected_phone || '').replace(/\D/g, '');
      const expSender = String(waitCtx.expected_sender || '').replace(/\D/g, '');

      if (!expPhone && !expSender || expPhone === cleanSender || expSender === cleanSender) {
        const resumed = await this.resumeWaitingExecution(exec.id, {
          text: messageText,
          sender: senderPhone,
          received_at: new Date().toISOString(),
        });
        if (resumed) resumedCount++;
      }
    }

    return resumedCount;
  }
}

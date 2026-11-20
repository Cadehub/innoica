// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Structured Generative AI Workflow Compiler
// Compiles free-form conversational instructions into deterministic Zod workflows
// ====================================================================

import {
  CreateWorkflowSchema,
  compileNaturalInstruction,
} from '@innoica/shared';
import type {
  NaturalInstructionCompileResult,
  AIProvider,
  WorkflowDefinition,
} from '@innoica/shared';
import { createWorkerSupabaseClient } from '@innoica/database';
import { dispatchLLMCall } from '../adapters/index.js';

const SYSTEM_PROMPT_COMPILER = `Tu es le compilateur universel de workflows automatisés d'INNOICA WhatsApp Agent.
Ton rôle est de convertir une consigne métier en langage naturel en un workflow déterministe au format JSON strict.

RÈGLES D'ARCHITECTURE :
1. Le workflow est un graphe dirigé d'actions déterministes (DAG).
2. Actions valides autorisées :
   - 'send_private_message' : payload={ text, recipient_phone?, media_url?, media_type? }
   - 'send_group_message' : payload={ text, group_jid }
   - 'send_supplier_inquiry' : payload={ template, supplier_phone, recipient_role }
   - 'notify_manager' : payload={ title, summary, recipient_phone }
   - 'wait_for_message' : payload={ timeout_minutes, expected_phone?, variable_to_store }
   - 'wait_delay' : payload={ delay_seconds }
   - 'webhook_call' : payload={ url, method, headers, body }
   - 'transfer_to_human' : payload={ reason }
   - 'record_employee_absence' : payload={ employee_identifier, reason }
   - 'generate_business_report' : payload={ period }
   - 'verify_product_stock' : payload={ product_name }
   - 'update_group_settings' : payload={ group_jid }
   - 'kick_group_participant' : payload={ group_jid, participant_jid }

3. Déclencheurs valides autorisés :
   - 'wa_private_message_received', 'wa_private_voice_received', 'wa_private_image_received'
   - 'wa_group_message_received', 'wa_group_bot_mentioned'
   - 'schedule_cron', 'schedule_interval'

4. Variables disponibles pour interpolation {{variable.field}} :
   - {{contact.phone}}, {{contact.name}}
   - {{client.phone}}, {{client.name}}
   - {{message.text}}, {{message.id}}
   - {{supplier_response.text}}
   - {{received_reply.text}}
   - {{group.jid}}, {{group.name}}

Réponds EXCLUSIVEMENT avec un bloc JSON contenant :
{
  "name": "Nom descriptif court",
  "description": "Explication claire",
  "domain": "general" | "sales" | "support" | "suppliers" | "inventory" | "orders" | "hr" | "internal" | "group_mgmt" | "channel_mgmt" | "commerce",
  "trigger_type": "...",
  "trigger_config": {},
  "conditions": [ { "field": "...", "operator": "equals"|"contains"|"matches_regex"|"greater_than"|"is_empty", "value": ... } ],
  "steps": [
    {
      "id": "step_1",
      "name": "Titre étape",
      "action_type": "...",
      "payload": {},
      "next_step_id": "step_2",
      "require_approval": false,
      "on_error": "fail"
    }
  ],
  "missing_information": ["..."],
  "explanation": "..."
}`;

export class AIWorkflowCompiler {
  private supabase = createWorkerSupabaseClient();

  public async compile(
    instruction: string,
    options?: {
      agentId?: string | null;
      workspaceId?: string;
      preferredDomain?: any;
      locale?: 'fr' | 'en';
    }
  ): Promise<NaturalInstructionCompileResult> {
    const fallback = compileNaturalInstruction(instruction, options);

    try {
      // 1. Récupérer les identifiants IA de l'agent ou du workspace
      let agent: any = null;
      if (options?.agentId) {
        const { data } = await this.supabase
          .from('agents')
          .select('workspace_id, ai_provider, ai_model')
          .eq('id', options.agentId)
          .single();
        agent = data;
      }

      const workspaceId = options?.workspaceId || agent?.workspace_id;
      const provider: AIProvider = (agent?.ai_provider as AIProvider) || 'groq';
      let apiKey: string | undefined;

      if (workspaceId) {
        const { data: cred } = await this.supabase
          .from('ai_credentials')
          .select('api_key')
          .eq('workspace_id', workspaceId)
          .eq('provider', provider)
          .eq('is_valid', true)
          .maybeSingle();
        apiKey = cred?.api_key;
      }

      apiKey = apiKey || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return fallback;
      }

      // 2. Invocation LLM
      const prompt = `Consigne utilisateur à compiler :\n"""\n${instruction}\n"""\n\nGénère le JSON complet du workflow.`;
      const model = provider === 'groq' ? 'openai/gpt-oss-120b' : 'gpt-4o-mini';

      const responseText = await dispatchLLMCall(provider, {
        apiKey,
        model,
        temperature: 0.1,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_COMPILER },
          { role: 'user', content: prompt },
        ],
      });

      // 3. Extraction et validation JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return fallback;
      }

      const parsedJson = JSON.parse(jsonMatch[0]);
      const validatedWorkflow = CreateWorkflowSchema.safeParse({
        name: parsedJson.name || fallback.workflow?.name,
        description: parsedJson.description || null,
        agent_id: options.agentId || null,
        domain: parsedJson.domain || fallback.detectedDomain,
        natural_instruction: instruction,
        trigger_type: parsedJson.trigger_type || fallback.workflow?.trigger_type,
        trigger_config: parsedJson.trigger_config || {},
        conditions: parsedJson.conditions || fallback.workflow?.conditions || [],
        steps: parsedJson.steps || fallback.workflow?.steps || [],
        status: 'active',
        priority: 10,
        version: 1,
        is_active_version: true,
      });

      if (!validatedWorkflow.success) {
        return fallback;
      }

      const wf = validatedWorkflow.data;
      const dryRunSteps = wf.steps.map((s) => ({
        stepName: s.name,
        action: s.action_type,
        outputPreview: `Action ${s.action_type} prête pour exécution.`,
      }));

      return {
        success: true,
        detectedDomain: wf.domain,
        humanExplanation: parsedJson.explanation || fallback.humanExplanation,
        confidenceScore: 0.98,
        missingInformation: parsedJson.missing_information || fallback.missingInformation,
        requiredPermissions: fallback.requiredPermissions,
        simulatedDryRun: {
          triggerSimulated: wf.trigger_type,
          stepsSimulated: dryRunSteps,
        },
        workflow: {
          ...wf,
          id: 'draft',
          workspace_id: workspaceId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as unknown as Partial<WorkflowDefinition>,
      };
    } catch {
      return fallback;
    }
  }
}

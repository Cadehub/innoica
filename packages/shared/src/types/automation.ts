// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Programmable Agents & Universal Automation Types
// ====================================================================

export type AutomationDomain =
  | 'general'
  | 'sales'
  | 'support'
  | 'suppliers'
  | 'inventory'
  | 'orders'
  | 'delivery'
  | 'hr'
  | 'internal'
  | 'appointments'
  | 'group_mgmt'
  | 'channel_mgmt'
  | 'commerce';

export type TriggerCategory = 'wa_private' | 'wa_group' | 'wa_channel' | 'business' | 'schedule';

export type TriggerType =
  // WhatsApp Privé
  | 'wa_private_message_received'
  | 'wa_private_voice_received'
  | 'wa_private_image_received'
  | 'wa_private_unanswered_timeout'
  | 'wa_private_handoff_requested'
  // Groupes WhatsApp
  | 'wa_group_message_received'
  | 'wa_group_bot_mentioned'
  | 'wa_group_keyword_matched'
  | 'wa_group_question_detected'
  | 'wa_group_participant_joined'
  | 'wa_group_metadata_updated'
  // Chaînes WhatsApp
  | 'wa_channel_post_published'
  | 'wa_channel_reaction_received'
  | 'wa_channel_subscriber_updated'
  // Événements Métier
  | 'business_lead_created'
  | 'business_order_created'
  | 'business_order_status_changed'
  | 'business_stock_low'
  | 'business_complaint_raised'
  | 'business_absence_reported'
  | 'business_task_assigned'
  // Déclencheurs Temporels
  | 'schedule_cron'
  | 'schedule_interval'
  | 'schedule_specific_time';

export type ActionType =
  // Communication
  | 'send_private_message'
  | 'send_group_message'
  | 'send_channel_post'
  | 'send_supplier_inquiry'
  | 'notify_manager'
  | 'ask_question'
  | 'request_confirmation'
  | 'transfer_to_human'
  // Attente & Reprise
  | 'wait_for_message'
  | 'wait_delay'
  // Intégrations & Webhooks
  | 'webhook_call'
  // Contacts & CRM
  | 'search_contact'
  | 'upsert_contact'
  | 'add_contact_note'
  | 'set_contact_reminder'
  // Gestion Interne & RH
  | 'create_internal_task'
  | 'update_task_status'
  | 'record_employee_absence'
  | 'generate_business_report'
  // Commerce & Stock
  | 'verify_product_stock'
  | 'create_draft_order'
  | 'update_inventory'
  // Opérations WhatsApp Groupe (soumises à approbation si impactantes)
  | 'update_group_settings'
  | 'update_group_subject'
  | 'invite_group_participant'
  | 'kick_group_participant';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'matches_regex'
  | 'greater_than'
  | 'less_than'
  | 'in_list'
  | 'is_empty'
  | 'is_not_empty';

export interface WorkflowCondition {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
}

export interface WorkflowStepBranch {
  condition?: WorkflowCondition;
  next_step_id: string;
}

export interface WorkflowStep {
  id: string;
  name: string;
  action_type: ActionType;
  payload: Record<string, unknown>;
  timeout_minutes?: number;
  require_approval?: boolean;
  on_error?: 'fail' | 'continue' | 'retry';
  next_step_id?: string;
  branches?: WorkflowStepBranch[];
  depends_on?: string[];
}

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface WorkflowDefinition {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  name: string;
  description: string | null;
  domain: AutomationDomain;
  natural_instruction: string | null;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  conditions: WorkflowCondition[];
  steps: WorkflowStep[];
  status: WorkflowStatus;
  priority: number;
  version?: number;
  is_active_version?: boolean;
  parent_workflow_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type ExecutionStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'needs_approval'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface WorkflowExecutionWaitingContext {
  waiting_for_action: 'wait_for_message';
  step_index: number;
  expected_sender?: string;
  expected_phone?: string;
  correlation_key?: string;
  timeout_at: string;
  prompt_sent?: string;
  resume_variable_name?: string;
}

export interface WorkflowExecution {
  id: string;
  workspace_id: string;
  workflow_id: string;
  agent_id: string | null;
  idempotency_key?: string | null;
  correlation_id?: string | null;
  expected_sender_phone?: string | null;
  status: ExecutionStatus;
  trigger_event: TriggerType;
  trigger_payload: Record<string, unknown>;
  current_step_index: number;
  variables: Record<string, unknown>;
  waiting_context: WorkflowExecutionWaitingContext | null;
  error_details: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface WorkflowExecutionLog {
  id: string;
  execution_id: string;
  step_index: number;
  action_type: ActionType;
  status: 'started' | 'succeeded' | 'failed' | 'waiting' | 'skipped';
  input_payload?: Record<string, unknown> | null;
  output_payload?: Record<string, unknown> | null;
  error_message?: string | null;
  duration_ms?: number | null;
  created_at: string;
}

export interface WorkflowApproval {
  id: string;
  workspace_id: string;
  execution_id: string;
  step_index: number;
  action_type: ActionType;
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  resolved_by?: string | null;
  requested_at: string;
  resolved_at?: string | null;
}

export interface WhatsAppGroupConfig {
  id: string;
  workspace_id: string;
  agent_id: string;
  group_jid: string;
  group_name: string;
  is_active: boolean;
  monitor_mode: 'mentions_only' | 'keywords_only' | 'all_messages' | 'smart_needed';
  keywords: string[];
  custom_instructions: string | null;
  allow_admin_actions: boolean;
  allowed_participants: string[];
  created_at: string;
  updated_at: string;
}

export interface WhatsAppChannelConfig {
  id: string;
  workspace_id: string;
  agent_id: string;
  channel_jid: string;
  channel_name: string;
  is_active: boolean;
  auto_publish_enabled: boolean;
  require_human_approval: boolean;
  custom_instructions: string | null;
  created_at: string;
  updated_at: string;
}

export interface NaturalInstructionCompileResult {
  success: boolean;
  workflow?: Partial<WorkflowDefinition>;
  detectedDomain: AutomationDomain;
  humanExplanation: string;
  confidenceScore: number;
  missingInformation: string[];
  requiredPermissions: string[];
  simulatedDryRun?: {
    triggerSimulated: string;
    stepsSimulated: Array<{ stepName: string; action: string; outputPreview: string }>;
  };
  error?: string;
}

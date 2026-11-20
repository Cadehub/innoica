// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Zod Validation Schemas for Automation
// ====================================================================

import { z } from 'zod';

export const AutomationDomainSchema = z.enum([
  'general',
  'sales',
  'support',
  'suppliers',
  'inventory',
  'orders',
  'delivery',
  'hr',
  'internal',
  'appointments',
  'group_mgmt',
  'channel_mgmt',
  'commerce',
]);

export const TriggerTypeSchema = z.enum([
  // WhatsApp Privé
  'wa_private_message_received',
  'wa_private_voice_received',
  'wa_private_image_received',
  'wa_private_unanswered_timeout',
  'wa_private_handoff_requested',
  // Groupes WhatsApp
  'wa_group_message_received',
  'wa_group_bot_mentioned',
  'wa_group_keyword_matched',
  'wa_group_question_detected',
  'wa_group_participant_joined',
  'wa_group_metadata_updated',
  // Chaînes WhatsApp
  'wa_channel_post_published',
  'wa_channel_reaction_received',
  'wa_channel_subscriber_updated',
  // Événements Métier
  'business_lead_created',
  'business_order_created',
  'business_order_status_changed',
  'business_stock_low',
  'business_complaint_raised',
  'business_absence_reported',
  'business_task_assigned',
  // Déclencheurs Temporels
  'schedule_cron',
  'schedule_interval',
  'schedule_specific_time',
]);

export const ActionTypeSchema = z.enum([
  // Communication
  'send_private_message',
  'send_group_message',
  'send_channel_post',
  'send_supplier_inquiry',
  'notify_manager',
  'ask_question',
  'request_confirmation',
  'transfer_to_human',
  // Attente & Reprise
  'wait_for_message',
  'wait_delay',
  // Intégrations & Webhooks
  'webhook_call',
  // Contacts & CRM
  'search_contact',
  'upsert_contact',
  'add_contact_note',
  'set_contact_reminder',
  // Gestion Interne & RH
  'create_internal_task',
  'update_task_status',
  'record_employee_absence',
  'generate_business_report',
  // Commerce & Stock
  'verify_product_stock',
  'create_draft_order',
  'update_inventory',
  // Opérations WhatsApp Groupe
  'update_group_settings',
  'update_group_subject',
  'invite_group_participant',
  'kick_group_participant',
]);

export const ConditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'matches_regex',
  'greater_than',
  'less_than',
  'in_list',
  'is_empty',
  'is_not_empty',
]);

export const WorkflowConditionSchema = z.object({
  field: z.string().min(1),
  operator: ConditionOperatorSchema,
  value: z.any().optional(),
});

export const WorkflowStepBranchSchema = z.object({
  condition: WorkflowConditionSchema.optional(),
  next_step_id: z.string().min(1),
});

export const WorkflowStepSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  action_type: ActionTypeSchema,
  payload: z.record(z.any()).default({}),
  timeout_minutes: z.number().int().positive().optional(),
  require_approval: z.boolean().optional(),
  on_error: z.enum(['fail', 'continue', 'retry']).default('fail'),
  next_step_id: z.string().optional(),
  branches: z.array(WorkflowStepBranchSchema).optional(),
  depends_on: z.array(z.string()).optional(),
});

export const WorkflowStatusSchema = z.enum(['draft', 'active', 'paused', 'archived']);

export const CreateWorkflowSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  description: z.string().optional().nullable(),
  agent_id: z.string().uuid().optional().nullable(),
  domain: AutomationDomainSchema.default('general'),
  natural_instruction: z.string().optional().nullable(),
  trigger_type: TriggerTypeSchema,
  trigger_config: z.record(z.any()).default({}),
  conditions: z.array(WorkflowConditionSchema).default([]),
  steps: z.array(WorkflowStepSchema).min(1, 'Au moins une étape d’action est requise'),
  status: WorkflowStatusSchema.default('active'),
  priority: z.number().int().default(0),
  version: z.number().int().positive().default(1),
  is_active_version: z.boolean().default(true),
  parent_workflow_id: z.string().uuid().optional().nullable(),
});

export const CompileNaturalInstructionSchema = z.object({
  instruction: z.string().min(5, 'L’instruction doit contenir au moins 5 caractères'),
  agent_id: z.string().uuid().optional().nullable(),
  preferred_domain: AutomationDomainSchema.optional(),
});

export const WhatsAppGroupConfigSchema = z.object({
  group_jid: z.string().regex(/@g\.us$/, 'Le JID doit être un identifiant de groupe (@g.us)'),
  group_name: z.string().min(1),
  is_active: z.boolean().default(false),
  monitor_mode: z
    .enum(['mentions_only', 'keywords_only', 'all_messages', 'smart_needed'])
    .default('smart_needed'),
  keywords: z.array(z.string()).default([]),
  custom_instructions: z.string().optional().nullable(),
  allow_admin_actions: z.boolean().default(false),
  allowed_participants: z.array(z.string()).default([]),
});

export const WhatsAppChannelConfigSchema = z.object({
  channel_jid: z.string().regex(/@newsletter$/, 'Le JID doit être un identifiant de chaîne (@newsletter)'),
  channel_name: z.string().min(1),
  is_active: z.boolean().default(false),
  auto_publish_enabled: z.boolean().default(false),
  require_human_approval: z.boolean().default(true),
  custom_instructions: z.string().optional().nullable(),
});

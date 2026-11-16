// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Core Domain Types
// ====================================================================

export type UserRole = 'owner' | 'admin' | 'member';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export type PlanSlug = 'free' | 'starter';

export interface PlanCapabilities {
  voice_message_understanding: boolean;
  [key: string]: boolean | undefined;
}

export type VoiceQualityCategory =
  | 'high'
  | 'partial'
  | 'low'
  | 'no_speech'
  | 'unsupported'
  | 'processing_error';

export type VoiceComprehensionStatus = 'sufficient' | 'partial' | 'insufficient';

export type VoiceProcessingStatus =
  | 'queued'
  | 'blocked_free'
  | 'transcribing'
  | 'completed'
  | 'failed';

export type MessageType = 'text' | 'audio';

export type SensitiveActionType =
  | 'order'
  | 'booking'
  | 'payment'
  | 'cancellation'
  | 'profile_update';

export interface VoiceMessageMetadata {
  durationSeconds?: number | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  isVoiceNote?: boolean;
  detectedLanguage?: 'fr' | 'en' | 'unknown' | string | null;
  transcript?: string | null;
  qualityCategory?: VoiceQualityCategory | null;
  comprehensionStatus?: VoiceComprehensionStatus | null;
  processingStatus?: VoiceProcessingStatus | null;
  processingMs?: number | null;
  extractedFacts?: string[];
  clarificationPrompt?: string | null;
  blockedReason?: 'free_plan' | 'no_speech' | 'unsupported' | 'processing_error' | null;
  errorCode?: string | null;
}

export interface ClarificationState {
  pendingTopic?: string | null;
  awaitingConfirmation?: boolean;
  proposedAction?: SensitiveActionType | null;
  validatedFacts?: string[];
  ambiguousPoints?: string[];
  missingDetails?: string[];
  lastSourceType?: MessageType | null;
  updatedAt?: string | null;
}

export interface Plan {
  id: string;
  slug: PlanSlug;
  name_fr: string;
  name_en: string;
  description_fr: string | null;
  description_en: string | null;
  price_monthly_xaf: number;
  price_yearly_xaf: number;
  max_agents: number;
  max_connections: number;
  max_knowledge_docs: number;
  max_daily_new_conversations: number | null;
  max_daily_bot_replies_per_conv: number | null;
  history_retention_days: number | null;
  has_watermark: boolean;
  allowed_knowledge_types: KnowledgeSourceType[];
  capabilities?: PlanCapabilities;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentDeclaration {
  id: string;
  workspace_id: string;
  submitted_by: string;
  plan_id: string;
  billing_cycle: 'monthly' | 'yearly';
  amount_xaf: number;
  payment_method: string;
  reference: string;
  paid_at: string;
  proof_note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
}

export interface WorkspaceQuotaSnapshot {
  workspaceId: string;
  workspaceStatus?: string;
  planSlug: PlanSlug;
  periodDate: string; // Africa/Douala YYYY-MM-DD
  hasWatermark: boolean;
  hasVoiceUnderstanding: boolean;
  capabilities: PlanCapabilities;
  maxAgents: number;
  maxConnections: number;
  maxKnowledgeDocs: number;
  maxDailyNewConversations: number | null;
  maxDailyBotRepliesPerConv: number | null;
  historyRetentionDays: number | null;
  allowedKnowledgeTypes: KnowledgeSourceType[];
  dailyNewConversationsUsed: number;
  dailyBotRepliesUsed?: number;
  agentsCount: number;
  connectionsCount: number;
  subscriptionStatus: SubscriptionStatus;
  billingCycle: 'monthly' | 'yearly';
  currentPeriodEnd: string | null;
}

export interface ConversationMemory {
  id: string;
  conversation_id: string;
  key: string;
  value: string;
  confidence: number;
  created_at: string;
  updated_at: string;
}

export type SubscriptionStatus = 'trial' | 'pending' | 'active' | 'past_due' | 'expired' | 'cancelled';

export interface Subscription {
  id: string;
  workspace_id: string;
  plan_id: string;
  billing_cycle: 'monthly' | 'yearly';
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}

export type AgentTemplateSlug =
  | 'receptionist'
  | 'sales'
  | 'support'
  | 'booking'
  | 'restaurant'
  | 'custom';

export interface AgentTemplate {
  id: string;
  slug: AgentTemplateSlug;
  name_fr: string;
  name_en: string;
  description_fr: string;
  description_en: string;
  default_system_prompt_fr: string;
  default_system_prompt_en: string;
  icon: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

export type AgentStatus =
  | 'draft'
  | 'pending_connection'
  | 'connected'
  | 'active'
  | 'paused'
  | 'error'
  | 'disconnected';

export type AIProvider = 'openrouter' | 'groq' | 'gemini' | 'openai';

export interface AICredential {
  id: string;
  workspace_id: string;
  provider: AIProvider;
  label: string;
  key_hint: string; // e.g. "sk-...9f4a"
  is_valid: boolean;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  workspace_id: string;
  template_id: string | null;
  name: string;
  description: string | null;
  avatar_url: string | null;
  primary_language: 'fr' | 'en';
  system_prompt: string;
  personality_traits: string[];
  status: AgentStatus;
  is_memory_enabled: boolean;
  ai_credential_id: string | null;
  ai_provider: AIProvider;
  ai_model: string;
  ai_temperature: number;
  created_at: string;
  updated_at: string;
}

export type WhatsAppConnectionStatus = 'pending' | 'pairing' | 'connected' | 'disconnected' | 'error';

export interface WhatsAppConnection {
  id: string;
  workspace_id: string;
  agent_id: string;
  phone_number: string;
  status: WhatsAppConnectionStatus;
  pairing_code: string | null;
  pairing_code_expires_at: string | null;
  last_connected_at: string | null;
  disconnect_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type KnowledgeSourceType = 'faq' | 'pdf' | 'txt' | 'url';

export type KnowledgeStatus = 'pending' | 'processing' | 'ready' | 'error';

export interface KnowledgeSource {
  id: string;
  agent_id: string;
  source_type: KnowledgeSourceType;
  title: string;
  file_path: string | null;
  source_url: string | null;
  raw_content: string | null;
  status: KnowledgeStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeChunk {
  id: string;
  source_id: string;
  agent_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  created_at: string;
}

export interface Contact {
  id: string;
  workspace_id: string;
  phone_number: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export type ControlMode = 'ai_active' | 'human_takeover' | 'paused';

export interface Conversation {
  id: string;
  agent_id: string;
  contact_id: string;
  control_mode: ControlMode;
  preferred_language?: 'fr' | 'en' | null;
  clarification_state?: ClarificationState | null;
  last_message_at: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
  // Joins
  contact?: Contact;
  agent?: Agent;
}

export type SenderType = 'contact' | 'agent' | 'human';

export type DeliveryStatus =
  | 'received'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'cancelled';

export interface Message {
  id: string;
  conversation_id: string;
  wa_message_id: string | null;
  sender_type: SenderType;
  message_type?: MessageType;
  voice_metadata?: VoiceMessageMetadata | null;
  content: string;
  delivery_status: DeliveryStatus;
  created_at: string;
}

export interface ContactMemory {
  id: string;
  contact_id: string;
  key: string;
  value: string;
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface ExecutionLog {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  level: 'info' | 'warn' | 'error';
  event_type: string;
  message: string;
  details: Record<string, unknown>;
  created_at: string;
}

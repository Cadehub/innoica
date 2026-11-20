// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Shared Client-Safe Exports
// ====================================================================

export * from './types/index';
export {
  APP_CONFIG,
  AI_PROVIDERS_CONFIG,
  AGENT_TEMPLATES,
  PLAN_CATALOG,
  DEFAULT_WATERMARK_TEMPLATE_FR,
  DEFAULT_WATERMARK_TEMPLATE_EN,
  VOICE_FREE_PLAN_MESSAGES,
  VOICE_FALLBACK_MESSAGES,
  VISION_FALLBACK_MESSAGES,
  resolveVoiceCapabilities,
  resolveCommerceCapabilities,
  getAfricaDoualaDateString,
  resolveOfficialAppUrl,
  buildWatermarkText,
  applyPlanWatermark,
  sanitizeKnowledgeContent,
} from './constants/index';
export {
  COUNTRY_DIAL_CODES,
  parseE164Phone,
  formatE164Phone,
} from './constants/countries';
export {
  internationalPhoneSchema,
  normalizePhoneNumberForBaileys,
  aiCredentialCreateSchema,
  agentFormSchema,
  requestPairingCodeSchema,
  knowledgeFaqSchema,
  knowledgeUrlSchema,
  paymentDeclarationSchema,
  adminPaymentDecisionSchema,
  adminPlanConfigSchema,
  memoryUpsertSchema,
  sendHumanMessageSchema,
  changeControlModeSchema,
  hexColorRegex,
  slugRegex,
  cameroonPhoneRegex,
  orderNumberRegex,
  RESERVED_STORE_SLUGS,
  isReservedStoreSlug,
  deliveryMethodSchema,
  paymentMethodSchema,
  paymentStatusSchema,
  orderStatusSchema,
  storeBuilderSectionTypeSchema,
  storeBuilderSectionSchema,
  storeLayoutSchema,
  storeSettingsSchema,
  productCategorySchema,
  productSchema,
  productVariantSchema,
  deliveryZoneSchema,
  storeCustomerSchema,
  storeCartSchema,
  storeCartItemSchema,
  storeOrderSchema,
  storeOrderItemSchema,
  storeOrderItemInputSchema,
  createStoreOrderPayloadSchema,
  orderStatusTransitionSchema,
} from './schemas/index';
export * from './types/ecommerce';
export * from './types/automation';
export * from './schemas/automation';
export { compileNaturalInstruction } from './automation/compiler';

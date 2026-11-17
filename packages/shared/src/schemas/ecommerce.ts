// ====================================================================
// INNOICA WhatsApp Agents v2.0 — E-Commerce Zod Schemas
// Native Multi-Tenant E-Commerce Engine (Requirement R3)
// ====================================================================

import { z } from 'zod';

/**
 * Regex pour valider une couleur hexadécimale (#RGB ou #RRGGBB)
 */
export const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Regex pour valider un slug d'URL (minuscules, chiffres, tirets)
 */
export const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Regex pour valider un numéro de téléphone mobile au Cameroun
 * Formats acceptés : +2376XXXXXXXX, +2372XXXXXXXX, 6XXXXXXXX, 2XXXXXXXX
 */
export const cameroonPhoneRegex = /^(\+?237)?[26]\d{8}$/;

/**
 * Numéro de commande au format INNOICA : CMD-YYYYMMDD-XXXX
 */
export const orderNumberRegex = /^CMD-\d{8}-\d{4,}$/;

/**
 * Liste des slugs réservés par l'infrastructure, l'application SaaS et les routes système.
 * Empêche toute collision de sous-domaine ou de chemin canonique multi-tenant.
 */
export const RESERVED_STORE_SLUGS = new Set([
  // Infrastructure & Next.js
  'api',
  'apis',
  'auth',
  '_next',
  '_vercel',
  'static',
  'assets',
  'images',
  'icons',
  'fonts',
  'favicon',
  'robots',
  'sitemap',
  'manifest',
  'sw',
  // Routes SaaS Plateforme
  'login',
  'register',
  'dashboard',
  'admin',
  'administrator',
  'superadmin',
  'settings',
  'subscription',
  'billing',
  'agents',
  'conversations',
  'knowledge',
  'whatsapp',
  'ai-credentials',
  'legal',
  'privacy',
  'terms',
  'store',
  'stores',
  // Réseau & Services
  'www',
  'app',
  'apps',
  'mail',
  'email',
  'cpanel',
  'webmail',
  'staging',
  'dev',
  'test',
  'demo',
  'preview',
  'cdn',
  'ws',
  'worker',
  'workers',
  'status',
  // Vitrine & E-Commerce
  'pricing',
  'checkout',
  'cart',
  'order',
  'orders',
  'products',
  'catalog',
  'help',
  'support',
  'contact',
  // Noms de marque
  'innoica',
  'oraimo',
  'cameroon',
]);

/**
 * Vérifie si un slug de boutique est réservé par la plateforme
 */
export function isReservedStoreSlug(slug: string): boolean {
  if (!slug) return false;
  return RESERVED_STORE_SLUGS.has(slug.toLowerCase().trim());
}

// --------------------------------------------------------------------
// Énumérations e-commerce
// --------------------------------------------------------------------

export const deliveryMethodSchema = z.enum(['delivery', 'pickup'], {
  required_error: 'Veuillez choisir un mode de livraison (livraison ou retrait sur place)',
});

export const paymentMethodSchema = z.enum(['cash_on_delivery', 'pickup', 'manual_mobile_money'], {
  required_error: 'Veuillez choisir un mode de paiement valide',
});

export const paymentStatusSchema = z.enum(
  ['pending_verification', 'paid', 'failed', 'refunded'],
  {
    required_error: 'Statut de paiement invalide',
  }
);

export const orderStatusSchema = z.enum(
  ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
  {
    required_error: 'Statut de commande invalide',
  }
);

export const storeBuilderSectionTypeSchema = z.enum([
  'hero',
  'catalog_grid',
  'features_banner',
  'about',
  'footer',
]);

// --------------------------------------------------------------------
// Store Builder Layout Schema (Anti-XSS & Intégrité Visuelle)
// --------------------------------------------------------------------

export const storeBuilderSectionSchema = z.object({
  id: z.string().min(1, "L'identifiant de section est obligatoire"),
  type: storeBuilderSectionTypeSchema,
  visible: z.boolean().default(true),
  order: z.number().int().min(0).default(0),
  settings: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Schéma du constructeur visuel de boutique
 * Interdit formellement toute injection de script ou balises brutes
 */
export const storeLayoutSchema = z
  .object({
    themeColor: z
      .string()
      .trim()
      .regex(hexColorRegex, 'La couleur thématique doit être un code hexadécimal valide (ex: #25D366)')
      .default('#25D366'),
    sections: z.array(storeBuilderSectionSchema).default([]),
    announcement: z
      .object({
        enabled: z.boolean().default(false),
        text: z.string().trim().max(200).default(''),
      })
      .optional(),
    draft: z.any().optional(),
    history: z.array(z.any()).optional(),
  })
  .passthrough();

// --------------------------------------------------------------------
// 10 Modèles de Tables Base de Données E-Commerce
// --------------------------------------------------------------------

// 1. Paramètres de la boutique
export const storeSettingsSchema = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid({ message: 'Identifiant workspace invalide' }),
  storeSlug: z
    .string()
    .trim()
    .min(2, 'Le slug de boutique doit comporter au moins 2 caractères')
    .max(60, 'Le slug ne doit pas dépasser 60 caractères')
    .regex(slugRegex, 'Le slug ne doit comporter que des lettres minuscules, chiffres et tirets')
    .refine((slug) => !RESERVED_STORE_SLUGS.has(slug.toLowerCase()), {
      message: 'Ce nom de boutique est réservé par la plateforme.',
    }),
  storeName: z
    .string()
    .trim()
    .min(2, 'Le nom de la boutique doit comporter au moins 2 caractères')
    .max(100, 'Le nom ne doit pas dépasser 100 caractères'),
  description: z.string().trim().max(1000).nullable().optional(),
  logoUrl: z.string().url('URL du logo invalide').nullable().optional(),
  bannerUrl: z.string().url('URL de bannière invalide').nullable().optional(),
  themeColor: z.string().regex(hexColorRegex).default('#25D366'),
  currency: z.string().default('XAF'),
  isActive: z.boolean().default(true),
  builderLayout: storeLayoutSchema.default({ themeColor: '#25D366', sections: [] }),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

// 2. Catégories de Produits
export const productCategorySchema = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(2, 'Le nom de la catégorie doit comporter au moins 2 caractères').max(80),
  slug: z.string().trim().min(2).max(80).regex(slugRegex),
  description: z.string().trim().max(500).nullable().optional(),
  displayOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

// 3. Produits
export const productSchema = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2, 'Le titre du produit est requis').max(150),
  slug: z.string().trim().min(2).max(150).regex(slugRegex),
  description: z.string().trim().max(5000).nullable().optional(),
  basePriceXaf: z.number().int('Le prix doit être un entier en FCFA').min(0, 'Le prix ne peut être négatif'),
  compareAtPriceXaf: z.number().int().min(0).nullable().optional(),
  costPriceXaf: z.number().int().min(0).nullable().optional(),
  images: z.array(z.string().url()).default([]),
  sku: z.string().trim().max(50).nullable().optional(),
  barcode: z.string().trim().max(50).nullable().optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  stockQuantity: z.number().int().min(0, 'Le stock ne peut être négatif').default(0),
  trackStock: z.boolean().default(true),
  hasVariants: z.boolean().default(false),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

// 4. Variantes de Produits
export const productVariantSchema = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid(),
  productId: z.string().uuid(),
  title: z.string().trim().min(1, 'Le titre de la variante est requis').max(100),
  sku: z.string().trim().max(50).nullable().optional(),
  priceXaf: z.number().int().min(0, 'Le prix de la variante doit être positif'),
  stockQuantity: z.number().int().min(0).default(0),
  trackStock: z.boolean().default(true),
  attributes: z.record(z.string(), z.string()).default({}),
  isActive: z.boolean().default(true),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

// 5. Zones de Livraison
export const deliveryZoneSchema = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(2, 'Le nom de la zone est requis').max(100),
  description: z.string().trim().max(500).nullable().optional(),
  feeXaf: z.number().int().min(0, 'Les frais de livraison ne peuvent être négatifs').default(0),
  estimatedDeliveryTime: z.string().trim().max(100).nullable().optional(),
  isActive: z.boolean().default(true),
  allowsPickup: z.boolean().default(false),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

// 6. Clients de la Boutique
export const storeCustomerSchema = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid(),
  fullName: z.string().trim().min(2, 'Le nom complet est requis').max(120),
  phone: z.string().trim().min(6, 'Numéro de téléphone requis').max(25),
  email: z.string().trim().email('Adresse email invalide').nullable().optional(),
  deliveryAddress: z.string().trim().max(300).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  totalOrders: z.number().int().min(0).default(0),
  totalSpentXaf: z.number().int().min(0).default(0),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

// 7. Paniers Persistants
export const storeCartSchema = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid(),
  cartToken: z.string().uuid(),
  customerId: z.string().uuid().nullable().optional(),
  expiresAt: z.string().or(z.date()),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

// 8. Lignes de Panier
export const storeCartItemSchema = z.object({
  id: z.string().uuid().optional(),
  cartId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1, 'La quantité doit être au moins 1'),
  unitPriceSnapshotXaf: z.number().int().min(0),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

// 9. Commandes de Boutique
export const storeOrderSchema = z.object({
  id: z.string().uuid().optional(),
  workspaceId: z.string().uuid(),
  orderNumber: z.string().regex(orderNumberRegex, 'Numéro de commande non conforme (CMD-YYYYMMDD-XXXX)'),
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().trim().min(2),
  customerPhone: z.string().trim().min(6),
  customerEmail: z.string().trim().email().nullable().optional(),
  deliveryZoneId: z.string().uuid().nullable().optional(),
  deliveryMethod: deliveryMethodSchema,
  deliveryAddress: z.string().trim().nullable().optional(),
  deliveryFeeXaf: z.number().int().min(0).default(0),
  subtotalXaf: z.number().int().min(0),
  totalAmountXaf: z.number().int().min(0),
  paymentMethod: paymentMethodSchema,
  paymentStatus: paymentStatusSchema.default('pending_verification'),
  manualPaymentRef: z.string().trim().nullable().optional(),
  manualPaymentPhone: z.string().trim().nullable().optional(),
  orderStatus: orderStatusSchema.default('pending'),
  notes: z.string().trim().max(1000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().or(z.date()).optional(),
  updatedAt: z.string().or(z.date()).optional(),
});

// 10. Lignes d'Articles de Commande
export const storeOrderItemSchema = z.object({
  id: z.string().uuid().optional(),
  orderId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  productId: z.string().uuid().nullable().optional(),
  variantId: z.string().uuid().nullable().optional(),
  productTitle: z.string().trim().min(1),
  variantTitle: z.string().trim().nullable().optional(),
  sku: z.string().trim().nullable().optional(),
  quantity: z.number().int().min(1),
  unitPriceXaf: z.number().int().min(0),
  totalPriceXaf: z.number().int().min(0),
  createdAt: z.string().or(z.date()).optional(),
});

// --------------------------------------------------------------------
// Payloads Opérationnels (Création Commande & Mises à Jour)
// --------------------------------------------------------------------

export const storeOrderItemInputSchema = z.object({
  productId: z.string().uuid('Identifiant de produit invalide'),
  variantId: z.string().uuid('Identifiant de variante invalide').nullable().optional(),
  quantity: z.number().int().min(1, 'La quantité doit être supérieure ou égale à 1'),
});

export const createStoreOrderPayloadSchema = z
  .object({
    storeSlug: z.string().trim().min(2, 'Le slug de la boutique est obligatoire'),
    customerName: z.string().trim().min(2, 'Le nom du client doit comporter au moins 2 caractères'),
    customerPhone: z
      .string()
      .trim()
      .regex(cameroonPhoneRegex, 'Numéro de téléphone camerounais invalide (ex: +237 6XXXXXXXX ou 6XXXXXXXX)'),
    customerEmail: z.string().trim().email('Adresse email invalide').nullable().optional(),
    deliveryZoneId: z.string().uuid().nullable().optional(),
    deliveryMethod: deliveryMethodSchema,
    deliveryAddress: z.string().trim().nullable().optional(),
    paymentMethod: paymentMethodSchema,
    items: z.array(storeOrderItemInputSchema).min(1, 'Le panier doit contenir au moins un article'),
    manualPaymentRef: z.string().trim().nullable().optional(),
    manualPaymentPhone: z.string().trim().nullable().optional(),
    deliveryNotes: z.string().trim().max(1000).nullable().optional(),
    cartToken: z.string().uuid().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((data, ctx) => {
    // Si livraison à domicile, l'adresse de livraison est requise
    if (data.deliveryMethod === 'delivery' && (!data.deliveryAddress || data.deliveryAddress.trim().length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deliveryAddress'],
        message: 'Une adresse de livraison est requise pour le mode livraison',
      });
    }
  });

export const orderStatusTransitionSchema = z.object({
  orderId: z.string().uuid('Identifiant de commande invalide'),
  orderStatus: orderStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
});

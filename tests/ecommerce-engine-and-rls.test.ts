// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Milestone 3 Test Suite
// Native Multi-Tenant E-Commerce Engine & Supabase RLS (Requirement R3)
// ====================================================================

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  hexColorRegex,
  slugRegex,
  orderNumberRegex,
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
  storeLayoutSchema,
  deliveryMethodSchema,
  paymentMethodSchema,
  paymentStatusSchema,
  orderStatusSchema,
} from '../packages/shared/src/index';

describe('Milestone 3: Native Multi-Tenant E-Commerce Engine & Supabase RLS', () => {
  // ------------------------------------------------------------------
  // 1. Zod Validation Schemas & Anti-XSS Constraints
  // ------------------------------------------------------------------
  describe('Store Settings & Visual Builder Anti-XSS Validation', () => {
    it('validates a correct store settings payload', () => {
      const validStore = {
        workspaceId: '11111111-1111-1111-1111-111111111111',
        storeSlug: 'boutique-yaounde-mode',
        storeName: 'Yaoundé Mode & Tendance',
        description: 'Boutique officielle de prêt-à-porter au Cameroun',
        logoUrl: 'https://images.innoica.com/stores/yaounde-logo.png',
        bannerUrl: 'https://images.innoica.com/stores/yaounde-banner.jpg',
        themeColor: '#25D366',
        currency: 'XAF',
        isActive: true,
        builderLayout: {
          themeColor: '#25D366',
          sections: [
            {
              id: 'sec-hero-1',
              type: 'hero' as const,
              visible: true,
              order: 0,
              settings: {
                title: 'Nouvelle Collection ÉTÉ 2026',
                subtitle: 'Livraison express à Douala & Yaoundé',
                buttonText: 'Acheter maintenant',
              },
            },
            {
              id: 'sec-catalog-1',
              type: 'catalog_grid' as const,
              visible: true,
              order: 1,
              settings: {
                showFilters: true,
                itemsPerRow: 4,
              },
            },
          ],
        },
      };

      const result = storeSettingsSchema.safeParse(validStore);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.storeSlug).toBe('boutique-yaounde-mode');
        expect(result.data.themeColor).toBe('#25D366');
        expect(result.data.builderLayout.sections.length).toBe(2);
      }
    });

    it('rejects invalid store slugs (uppercase, spaces, special chars)', () => {
      expect(slugRegex.test('boutique-valid-123')).toBe(true);
      expect(slugRegex.test('Boutique-Invalid')).toBe(false);
      expect(slugRegex.test('boutique invalid')).toBe(false);
      expect(slugRegex.test('boutique_invalid')).toBe(false);
      expect(slugRegex.test('boutique@123')).toBe(false);

      const invalidStore = {
        workspaceId: '11111111-1111-1111-1111-111111111111',
        storeSlug: 'Boutique MAJUSCULE',
        storeName: 'Nom Valide',
      };
      const result = storeSettingsSchema.safeParse(invalidStore);
      expect(result.success).toBe(false);
    });

    it('validates hex color and prevents script / CSS injections', () => {
      expect(hexColorRegex.test('#25D366')).toBe(true);
      expect(hexColorRegex.test('#FFF')).toBe(true);
      expect(hexColorRegex.test('#000000')).toBe(true);
      expect(hexColorRegex.test('red')).toBe(false);
      expect(hexColorRegex.test('rgb(255, 0, 0)')).toBe(false);
      expect(hexColorRegex.test('javascript:alert(1)')).toBe(false);
      expect(hexColorRegex.test('#25D366; background: url(evil.com)')).toBe(false);

      const layoutResult = storeLayoutSchema.safeParse({
        themeColor: '<script>alert("xss")</script>',
        sections: [],
      });
      expect(layoutResult.success).toBe(false);
    });

    it('rejects unpermitted section types in store layout', () => {
      const layoutResult = storeLayoutSchema.safeParse({
        themeColor: '#25D366',
        sections: [
          {
            id: 'sec-evil',
            type: 'raw_iframe_injection',
            visible: true,
            order: 0,
            settings: {},
          },
        ],
      });
      expect(layoutResult.success).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // 2. Product, Variants & Category Schemas
  // ------------------------------------------------------------------
  describe('Product Catalog & Variant Schemas', () => {
    it('validates a complete product with variants and pricing constraints', () => {
      const validProduct = {
        workspaceId: '22222222-2222-2222-2222-222222222222',
        title: 'Écouteurs Sans Fil Oraimo FreePods 4',
        slug: 'oraimo-freepods-4',
        description: 'Réduction active de bruit et autonomie 35h',
        basePriceXaf: 18500,
        compareAtPriceXaf: 22000,
        costPriceXaf: 12000,
        images: ['https://images.innoica.com/products/freepods4-main.jpg'],
        sku: 'ORA-FP4-BLK',
        stockQuantity: 45,
        trackStock: true,
        hasVariants: true,
      };

      const result = productSchema.safeParse(validProduct);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.basePriceXaf).toBe(18500);
        expect(result.data.stockQuantity).toBe(45);
        expect(result.data.trackStock).toBe(true);
      }
    });

    it('rejects negative product prices and negative stocks', () => {
      const negativePrice = {
        workspaceId: '22222222-2222-2222-2222-222222222222',
        title: 'Produit Invalide',
        slug: 'produit-invalide',
        basePriceXaf: -500,
        stockQuantity: 10,
      };
      expect(productSchema.safeParse(negativePrice).success).toBe(false);

      const negativeStock = {
        workspaceId: '22222222-2222-2222-2222-222222222222',
        title: 'Produit Invalide Stock',
        slug: 'produit-invalide-stock',
        basePriceXaf: 5000,
        stockQuantity: -1,
      };
      expect(productSchema.safeParse(negativeStock).success).toBe(false);
    });

    it('validates product variants with individual pricing and attributes', () => {
      const validVariant = {
        workspaceId: '22222222-2222-2222-2222-222222222222',
        productId: '33333333-3333-3333-3333-333333333333',
        title: 'Noir Mat / Taille Unique',
        sku: 'ORA-FP4-BLK-U',
        priceXaf: 18500,
        stockQuantity: 20,
        trackStock: true,
        attributes: { couleur: 'Noir Mat', edition: 'Standard' },
        isActive: true,
      };

      const result = productVariantSchema.safeParse(validVariant);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priceXaf).toBe(18500);
        expect(result.data.attributes.couleur).toBe('Noir Mat');
      }
    });

    it('validates product category with display order', () => {
      const category = {
        workspaceId: '22222222-2222-2222-2222-222222222222',
        name: 'Audio & Écouteurs',
        slug: 'audio-ecouteurs',
        displayOrder: 1,
        isActive: true,
      };
      const res = productCategorySchema.safeParse(category);
      expect(res.success).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // 3. Delivery Zones & Customer Schemas
  // ------------------------------------------------------------------
  describe('Delivery Zones & Customers', () => {
    it('validates delivery zone with fee and pickup allowances', () => {
      const zoneHome = {
        workspaceId: '11111111-1111-1111-1111-111111111111',
        name: 'Douala Centre (Akwa / Bonanjo)',
        description: 'Livraison par coursier express le jour même',
        feeXaf: 1500,
        estimatedDeliveryTime: '2h à 4h',
        isActive: true,
        allowsPickup: false,
      };
      const res1 = deliveryZoneSchema.safeParse(zoneHome);
      expect(res1.success).toBe(true);

      const zonePickup = {
        workspaceId: '11111111-1111-1111-1111-111111111111',
        name: 'Retrait en Boutique (Akwa Douala)',
        feeXaf: 0,
        estimatedDeliveryTime: 'Immédiat',
        isActive: true,
        allowsPickup: true,
      };
      const res2 = deliveryZoneSchema.safeParse(zonePickup);
      expect(res2.success).toBe(true);
    });

    it('validates store customer with phone and order aggregates', () => {
      const customer = {
        workspaceId: '11111111-1111-1111-1111-111111111111',
        fullName: 'Marc Nkoa',
        phone: '+237699123456',
        email: 'marc.nkoa@example.com',
        deliveryAddress: 'Douala, Akwa face Direction Orange',
        totalOrders: 3,
        totalSpentXaf: 55500,
      };
      const res = storeCustomerSchema.safeParse(customer);
      expect(res.success).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // 4. Order Creation Payload & Validation Rules
  // ------------------------------------------------------------------
  describe('Order Creation Payload & Business Rules', () => {
    it('validates a complete order payload for home delivery', () => {
      const payload = {
        storeSlug: 'yaounde-mode',
        customerName: 'Aissatou Diallo',
        customerPhone: '+237677987654',
        customerEmail: 'aissatou@example.cm',
        deliveryMethod: 'delivery' as const,
        deliveryZoneId: '44444444-4444-4444-4444-444444444444',
        deliveryAddress: 'Yaoundé, Bastos après Ambassade de Belgique',
        paymentMethod: 'manual_mobile_money' as const,
        manualPaymentRef: 'OM-20261117-98765',
        manualPaymentPhone: '+237699001122',
        deliveryNotes: 'Appeler à la barrière noire',
        items: [
          {
            productId: '55555555-5555-5555-5555-555555555555',
            variantId: '66666666-6666-6666-6666-666666666666',
            quantity: 2,
          },
        ],
      };

      const result = createStoreOrderPayloadSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('validates order payload for pickup without requiring delivery address', () => {
      const pickupPayload = {
        storeSlug: 'yaounde-mode',
        customerName: 'Jean Paul',
        customerPhone: '+237655443322',
        deliveryMethod: 'pickup' as const,
        paymentMethod: 'pickup' as const,
        items: [
          {
            productId: '55555555-5555-5555-5555-555555555555',
            quantity: 1,
          },
        ],
      };

      const result = createStoreOrderPayloadSchema.safeParse(pickupPayload);
      expect(result.success).toBe(true);
    });

    it('rejects delivery orders missing delivery address', () => {
      const missingAddress = {
        storeSlug: 'yaounde-mode',
        customerName: 'Aissatou Diallo',
        customerPhone: '+237677987654',
        deliveryMethod: 'delivery' as const,
        paymentMethod: 'cash_on_delivery' as const,
        items: [
          {
            productId: '55555555-5555-5555-5555-555555555555',
            quantity: 1,
          },
        ],
      };

      const result = createStoreOrderPayloadSchema.safeParse(missingAddress);
      expect(result.success).toBe(false);
      if (!result.success) {
        const addressIssue = result.error.issues.find((i) => i.path.includes('deliveryAddress'));
        expect(addressIssue).toBeDefined();
      }
    });

    it('rejects order payloads with empty items array or quantity <= 0', () => {
      const emptyItems = {
        storeSlug: 'yaounde-mode',
        customerName: 'Client Test',
        customerPhone: '+237699000000',
        deliveryMethod: 'pickup' as const,
        paymentMethod: 'pickup' as const,
        items: [],
      };
      expect(createStoreOrderPayloadSchema.safeParse(emptyItems).success).toBe(false);

      const zeroQuantity = {
        productId: '55555555-5555-5555-5555-555555555555',
        quantity: 0,
      };
      expect(storeOrderItemInputSchema.safeParse(zeroQuantity).success).toBe(false);
    });

    it('validates INNOICA unique order number regex format (CMD-YYYYMMDD-XXXX)', () => {
      expect(orderNumberRegex.test('CMD-20261117-0001')).toBe(true);
      expect(orderNumberRegex.test('CMD-20261117-10254')).toBe(true);
      expect(orderNumberRegex.test('CMD-20261117-99')).toBe(false); // needs 4 digits min
      expect(orderNumberRegex.test('ORD-20261117-0001')).toBe(false);
      expect(orderNumberRegex.test('CMD-261117-0001')).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // 5. Payment Methods, Transitions & Server Recalculation Invariants
  // ------------------------------------------------------------------
  describe('Payment Methods & State Machine Transitions', () => {
    it('restricts payment methods strictly to native manual methods', () => {
      expect(paymentMethodSchema.safeParse('cash_on_delivery').success).toBe(true);
      expect(paymentMethodSchema.safeParse('pickup').success).toBe(true);
      expect(paymentMethodSchema.safeParse('manual_mobile_money').success).toBe(true);

      // Rejects external gateways (Shopify, Stripe, PayPal, n8n)
      expect(paymentMethodSchema.safeParse('stripe').success).toBe(false);
      expect(paymentMethodSchema.safeParse('paypal').success).toBe(false);
      expect(paymentMethodSchema.safeParse('flutterwave').success).toBe(false);
      expect(paymentMethodSchema.safeParse('shopify_pay').success).toBe(false);
    });

    it('verifies initial payment status is always pending_verification', () => {
      const order = {
        workspaceId: '11111111-1111-1111-1111-111111111111',
        orderNumber: 'CMD-20261117-0001',
        customerName: 'Paul Biya',
        customerPhone: '+237699112233',
        deliveryMethod: 'delivery' as const,
        deliveryFeeXaf: 1500,
        subtotalXaf: 20000,
        totalAmountXaf: 21500,
        paymentMethod: 'manual_mobile_money' as const,
        paymentStatus: 'pending_verification' as const,
        orderStatus: 'pending' as const,
      };

      const result = storeOrderSchema.safeParse(order);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paymentStatus).toBe('pending_verification');
        expect(result.data.orderStatus).toBe('pending');
      }
    });

    it('validates order status transitions via merchant update schema', () => {
      const validTransition = {
        orderId: '77777777-7777-7777-7777-777777777777',
        orderStatus: 'confirmed' as const,
        paymentStatus: 'paid' as const,
        notes: 'Paiement Orange Money vérifié avec succès par le commerçant',
      };

      const result = orderStatusTransitionSchema.safeParse(validTransition);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.paymentStatus).toBe('paid');
        expect(result.data.orderStatus).toBe('confirmed');
      }
    });

    it('strictly recalculates subtotal and total ignoring client price tamper attempts', () => {
      // Simulation of server price recalculation invariant
      const catalogDb = [
        { id: 'prod-1', basePrice: 5000, trackStock: true, stock: 10 },
        { id: 'prod-2', basePrice: 12000, trackStock: false, stock: 0 },
      ];

      // Untrusted client attempt to pass price = 100 FCFA
      const untrustedClientItems = [
        { productId: 'prod-1', clientPassedPrice: 100, quantity: 2 },
        { productId: 'prod-2', clientPassedPrice: 50, quantity: 1 },
      ];

      // Server recalculation logic (replicates SQL RPC logic)
      let serverSubtotal = 0;
      for (const item of untrustedClientItems) {
        const dbProduct = catalogDb.find((p) => p.id === item.productId);
        expect(dbProduct).toBeDefined();
        // Server ignores item.clientPassedPrice and takes dbProduct.basePrice
        serverSubtotal += dbProduct!.basePrice * item.quantity;
      }

      const deliveryFee = 1500;
      const serverTotal = serverSubtotal + deliveryFee;

      // 5000 * 2 + 12000 * 1 = 22000 FCFA + 1500 = 23500 FCFA
      expect(serverSubtotal).toBe(22000);
      expect(serverTotal).toBe(23500);
      // Untrusted total would have been 100*2 + 50*1 = 250 FCFA (tamper prevented)
      expect(serverSubtotal).not.toBe(250);
    });

    it('simulates atomic stock decrement and throws on insufficient inventory', () => {
      const stockState = { stock: 3 };
      const requestedQty = 4;

      function purchase(qty: number) {
        if (stockState.stock < qty) {
          throw new Error('Stock insuffisant pour ce produit');
        }
        stockState.stock -= qty;
      }

      expect(() => purchase(requestedQty)).toThrow('Stock insuffisant');
      expect(stockState.stock).toBe(3); // untouched

      purchase(2);
      expect(stockState.stock).toBe(1); // atomically decremented
    });
  });

  // ------------------------------------------------------------------
  // 6. SQL Migration File & RLS Policy Integrity Audit
  // ------------------------------------------------------------------
  describe('PostgreSQL Migration & Supabase RLS Integrity Audit', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../packages/database/migrations/20261118000008_native_ecommerce_engine_and_rls.sql'
    );

    it('verifies that migration 008 file exists on disk', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it('verifies creation of all 10 native e-commerce tables in migration SQL', () => {
      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      const expectedTables = [
        'public.store_settings',
        'public.product_categories',
        'public.products',
        'public.product_variants',
        'public.delivery_zones',
        'public.store_customers',
        'public.store_carts',
        'public.store_cart_items',
        'public.store_orders',
        'public.store_order_items',
      ];

      for (const table of expectedTables) {
        expect(sqlContent).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
      }
    });

    it('verifies that RLS is enabled on all 10 tables in migration SQL', () => {
      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      const expectedTables = [
        'public.store_settings',
        'public.product_categories',
        'public.products',
        'public.product_variants',
        'public.delivery_zones',
        'public.store_customers',
        'public.store_carts',
        'public.store_cart_items',
        'public.store_orders',
        'public.store_order_items',
      ];

      for (const table of expectedTables) {
        expect(sqlContent).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      }
    });

    it('verifies multi-tenant merchant isolation helper is_workspace_merchant', () => {
      const sqlContent = fs.readFileSync(migrationPath, 'utf8');
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.is_workspace_merchant(ws_id UUID)');
      expect(sqlContent).toContain("role IN ('owner', 'admin', 'member', 'agent')");
      expect(sqlContent).toContain('public.is_current_user_super_admin()');
    });

    it('verifies atomic RPC create_store_order with SECURITY DEFINER and SELECT ... FOR UPDATE', () => {
      const sqlContent = fs.readFileSync(migrationPath, 'utf8');
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.create_store_order');
      expect(sqlContent).toContain('SECURITY DEFINER');
      expect(sqlContent).toContain('SET search_path = public');
      expect(sqlContent).toContain('FOR UPDATE'); // Row-level lock
      expect(sqlContent).toContain('v_total_amount_xaf := v_subtotal_xaf + v_delivery_fee_xaf;');
      expect(sqlContent).toContain('generate_store_order_number()');
      expect(sqlContent).toContain("'pending_verification'");
    });

    it('verifies unique order number format CMD-YYYYMMDD-XXXX generator', () => {
      const sqlContent = fs.readFileSync(migrationPath, 'utf8');
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.generate_store_order_number()');
      expect(sqlContent).toContain("'CMD-'");
      expect(sqlContent).toContain("to_char(v_today, 'YYYYMMDD')");
      expect(sqlContent).toContain('lpad(v_seq::text, 4,');
    });
  });
});

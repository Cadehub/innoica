// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Milestone 4 Test Suite
// Public Storefront & Visual Store Builder (Requirement R4)
// ====================================================================

import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import {
  RESERVED_STORE_SLUGS,
  isReservedStoreSlug,
  storeSettingsSchema,
  productSchema,
  storeLayoutSchema,
  cameroonPhoneRegex,
  createStoreOrderPayloadSchema,
  hexColorRegex,
} from '../packages/shared/src/index';
import { sanitizeUrl, sanitizeText, extractMerchantPhone } from '../apps/web/src/lib/sanitize-builder';
import { signOrderReceipt, verifyOrderReceipt } from '../apps/web/src/lib/order-receipt';
import {
  hasCommerceCapability,
  requireCommerceCapability,
  assertCommerceApiAccess,
  FeatureGateError,
} from '../apps/web/src/lib/feature-gating';
import { extractStoreSubdomain } from '../apps/web/src/middleware';
import { NextRequest } from 'next/server';

describe('Milestone 4: Public Storefront & Visual Store Builder Suite', () => {
  // ------------------------------------------------------------------
  // 1. Reserved Store Slugs & Collision Prevention
  // ------------------------------------------------------------------
  describe('Reserved Store Slugs & Multi-Tenant Collision Prevention', () => {
    it('defines and identifies reserved platform and infrastructure slugs', () => {
      expect(RESERVED_STORE_SLUGS.size).toBeGreaterThan(30);

      const criticalReserved = [
        'api',
        'admin',
        'dashboard',
        'auth',
        'login',
        'register',
        'store',
        'cart',
        'checkout',
        'orders',
        '_next',
        '_vercel',
        'www',
        'app',
        'whatsapp',
        'innoica',
        'oraimo',
        'cameroon',
      ];

      for (const slug of criticalReserved) {
        expect(RESERVED_STORE_SLUGS.has(slug)).toBe(true);
        expect(isReservedStoreSlug(slug)).toBe(true);
      }

      // Valid merchant slugs must NOT be reserved
      expect(isReservedStoreSlug('boutique-yaounde-mode')).toBe(false);
      expect(isReservedStoreSlug('electronique-douala')).toBe(false);
      expect(isReservedStoreSlug('kmer-deals-237')).toBe(false);
    });

    it('rejects reserved slugs in storeSettingsSchema with explicit error', () => {
      const reservedAttempts = ['api', 'admin', 'dashboard', 'store', 'cart', 'login', 'whatsapp'];

      for (const slug of reservedAttempts) {
        const payload = {
          workspaceId: '11111111-1111-1111-1111-111111111111',
          storeSlug: slug,
          storeName: 'Tentative Collisive',
        };
        const result = storeSettingsSchema.safeParse(payload);
        expect(result.success).toBe(false);
        if (!result.success) {
          const slugIssue = result.error.issues.find((i) => i.path.includes('storeSlug'));
          expect(slugIssue?.message).toContain('réservé par la plateforme');
        }
      }

      // Slugs with leading underscore are also blocked (by isReservedStoreSlug and format)
      expect(isReservedStoreSlug('_next')).toBe(true);
      expect(isReservedStoreSlug('_vercel')).toBe(true);
      expect(
        storeSettingsSchema.safeParse({
          workspaceId: '11111111-1111-1111-1111-111111111111',
          storeSlug: '_next',
          storeName: 'Tentative Collisive',
        }).success
      ).toBe(false);
    });

    it('accepts valid merchant store slugs in storeSettingsSchema', () => {
      const validPayload = {
        workspaceId: '11111111-1111-1111-1111-111111111111',
        storeSlug: 'oraimo-douala-officiel',
        storeName: 'Oraimo Douala Officiel',
        themeColor: '#00DF59',
      };
      const result = storeSettingsSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // 2. Anti-XSS Link & Text Sanitization
  // ------------------------------------------------------------------
  describe('Security & Anti-XSS Sanitization (Requirement R4)', () => {
    it('allows safe URLs and anchors while neutralizing dangerous scripts and protocols', () => {
      // Safe URLs
      expect(sanitizeUrl('#catalog')).toBe('#catalog');
      expect(sanitizeUrl('/store/ma-boutique/products')).toBe('/store/ma-boutique/products');
      expect(sanitizeUrl('https://images.unsplash.com/photo-123')).toBe(
        'https://images.unsplash.com/photo-123'
      );
      expect(sanitizeUrl('http://innoica.com')).toBe('http://innoica.com');

      // Dangerous schemes & protocol-relative URLs must be neutralized to '#'
      expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
      expect(sanitizeUrl('java\tscript:alert(1)')).toBe('#');
      expect(sanitizeUrl('JAVASCRIPT:steal()')).toBe('#');
      expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
      expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('#');
      expect(sanitizeUrl('//evil.com/phishing')).toBe('#');
      expect(sanitizeUrl('https://evil.com/<script>')).toBe('#');
      expect(sanitizeUrl('https://evil.com/"onload="alert(1)')).toBe('#');
      expect(sanitizeUrl('/\\evil.com')).toBe('#');
      expect(sanitizeUrl('/\\evil.com/phishing')).toBe('#');
      expect(sanitizeUrl('foo\\bar')).toBe('#');
      expect(sanitizeUrl(null)).toBe('#');
      expect(sanitizeUrl('')).toBe('#');
    });

    it('rejects javascript: and data: URLs in storeSettingsSchema and productSchema', () => {
      const badStoreLogo = storeSettingsSchema.safeParse({
        workspaceId: '11111111-1111-1111-1111-111111111111',
        storeSlug: 'boutique-yaounde',
        storeName: 'Boutique Yaoundé',
        logoUrl: 'javascript:alert(1)',
      });
      expect(badStoreLogo.success).toBe(false);

      const badStoreBanner = storeSettingsSchema.safeParse({
        workspaceId: '11111111-1111-1111-1111-111111111111',
        storeSlug: 'boutique-yaounde',
        storeName: 'Boutique Yaoundé',
        bannerUrl: 'data:text/html,<script>alert(1)</script>',
      });
      expect(badStoreBanner.success).toBe(false);

      const badProductImg = productSchema.safeParse({
        workspaceId: '11111111-1111-1111-1111-111111111111',
        title: 'FreePods 4',
        slug: 'freepods-4',
        basePriceXaf: 18500,
        images: ['javascript:alert(1)'],
      });
      expect(badProductImg.success).toBe(false);

      const validStoreMedia = storeSettingsSchema.safeParse({
        workspaceId: '11111111-1111-1111-1111-111111111111',
        storeSlug: 'boutique-yaounde',
        storeName: 'Boutique Yaoundé',
        logoUrl: 'https://cdn.innoica.com/logo.png',
        bannerUrl: 'http://cdn.innoica.com/banner.jpg',
      });
      expect(validStoreMedia.success).toBe(true);
    });

    it('strips HTML tags and script elements in text sanitization', () => {
      expect(sanitizeText('Bienvenue sur notre boutique')).toBe('Bienvenue sur notre boutique');
      expect(sanitizeText('<h1>Titre</h1>')).toBe('Titre');
      expect(sanitizeText('<script>fetch("https://evil.com")</script>Promotion ÉTÉ')).toBe(
        'Promotion ÉTÉ'
      );
      expect(sanitizeText('<img src="x" onerror="alert(1)">')).toBe('');
      expect(sanitizeText(null)).toBe('');
    });

    it('validates theme colors with hexColorRegex and rejects CSS injection', () => {
      expect(hexColorRegex.test('#25D366')).toBe(true);
      expect(hexColorRegex.test('#00DF59')).toBe(true);
      expect(hexColorRegex.test('#FFF')).toBe(true);
      expect(hexColorRegex.test('red')).toBe(false);
      expect(hexColorRegex.test('#25D366; background: url(evil.com)')).toBe(false);
      expect(hexColorRegex.test('<script>alert(1)</script>')).toBe(false);

      const invalidLayout = {
        themeColor: '#25D366; width: 100vw',
        sections: [],
      };
      expect(storeLayoutSchema.safeParse(invalidLayout).success).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // 3. Guest Checkout & Cameroon Phone Regex
  // ------------------------------------------------------------------
  describe('Guest Checkout Payload & Cameroon Phone Validation', () => {
    it('validates standard Cameroon phone formats', () => {
      // Valid Cameroon numbers
      expect(cameroonPhoneRegex.test('+237699123456')).toBe(true);
      expect(cameroonPhoneRegex.test('+237677987654')).toBe(true);
      expect(cameroonPhoneRegex.test('+237222334455')).toBe(true);
      expect(cameroonPhoneRegex.test('237699123456')).toBe(true);
      expect(cameroonPhoneRegex.test('699123456')).toBe(true);
      expect(cameroonPhoneRegex.test('677112233')).toBe(true);
      expect(cameroonPhoneRegex.test('242001122')).toBe(true);

      // Invalid numbers
      expect(cameroonPhoneRegex.test('+33612345678')).toBe(false); // France
      expect(cameroonPhoneRegex.test('+14155552671')).toBe(false); // USA
      expect(cameroonPhoneRegex.test('123456789')).toBe(false); // Starts with 1
      expect(cameroonPhoneRegex.test('69912345')).toBe(false); // 8 digits (too short)
      expect(cameroonPhoneRegex.test('6991234567')).toBe(false); // 10 digits (too long)
      expect(cameroonPhoneRegex.test('abcdefghi')).toBe(false);
    });

    it('validates a complete guest checkout payload', () => {
      const validCheckout = {
        storeSlug: 'oraimo-douala',
        customerName: 'Marc Nkoa',
        customerPhone: '+237699123456',
        customerEmail: 'marc.nkoa@example.cm',
        deliveryMethod: 'delivery' as const,
        deliveryAddress: 'Douala, Akwa face Direction Orange',
        deliveryZoneId: '11111111-1111-1111-1111-111111111111',
        paymentMethod: 'cash_on_delivery' as const,
        items: [
          {
            productId: '22222222-2222-2222-2222-222222222222',
            quantity: 1,
          },
        ],
      };

      const result = createStoreOrderPayloadSchema.safeParse(validCheckout);
      expect(result.success).toBe(true);
    });

    it('rejects guest checkout with non-Cameroon phone number', () => {
      const invalidPhoneCheckout = {
        storeSlug: 'oraimo-douala',
        customerName: 'Client Étranger',
        customerPhone: '+33612345678', // Non-Cameroon number
        deliveryMethod: 'pickup' as const,
        paymentMethod: 'pickup' as const,
        items: [
          {
            productId: '22222222-2222-2222-2222-222222222222',
            quantity: 1,
          },
        ],
      };

      const result = createStoreOrderPayloadSchema.safeParse(invalidPhoneCheckout);
      expect(result.success).toBe(false);
      if (!result.success) {
        const phoneIssue = result.error.issues.find((i) => i.path.includes('customerPhone'));
        expect(phoneIssue?.message).toContain('téléphone camerounais');
      }
    });

    it('requires delivery address only when deliveryMethod is delivery', () => {
      // Pickup without address is VALID
      const pickupOrder = {
        storeSlug: 'oraimo-douala',
        customerName: 'Jean Paul',
        customerPhone: '677112233',
        deliveryMethod: 'pickup' as const,
        paymentMethod: 'pickup' as const,
        items: [
          {
            productId: '22222222-2222-2222-2222-222222222222',
            quantity: 2,
          },
        ],
      };
      expect(createStoreOrderPayloadSchema.safeParse(pickupOrder).success).toBe(true);

      // Delivery without address is INVALID
      const deliveryWithoutAddress = {
        ...pickupOrder,
        deliveryMethod: 'delivery' as const,
        paymentMethod: 'cash_on_delivery' as const,
      };
      const res = createStoreOrderPayloadSchema.safeParse(deliveryWithoutAddress);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.some((i) => i.path.includes('deliveryAddress'))).toBe(true);
      }
    });

    it('rejects delivery + pickup payment combination and requires Mobile Money ref/phone', () => {
      const deliveryWithPickupPayment = {
        storeSlug: 'oraimo-douala',
        customerName: 'Marc Nkoa',
        customerPhone: '+237699123456',
        deliveryMethod: 'delivery' as const,
        deliveryAddress: 'Douala Akwa',
        paymentMethod: 'pickup' as const,
        items: [{ productId: '22222222-2222-2222-2222-222222222222', quantity: 1 }],
      };
      const resPickup = createStoreOrderPayloadSchema.safeParse(deliveryWithPickupPayment);
      expect(resPickup.success).toBe(false);
      if (!resPickup.success) {
        expect(
          resPickup.error.issues.some((i) =>
            i.message.includes("paiement au retrait n'est pas disponible")
          )
        ).toBe(true);
      }

      const momoMissingFields = {
        storeSlug: 'oraimo-douala',
        customerName: 'Marc Nkoa',
        customerPhone: '+237699123456',
        deliveryMethod: 'delivery' as const,
        deliveryAddress: 'Douala Akwa',
        paymentMethod: 'manual_mobile_money' as const,
        manualPaymentRef: null,
        manualPaymentPhone: null,
        items: [{ productId: '22222222-2222-2222-2222-222222222222', quantity: 1 }],
      };
      const resMomoMissing = createStoreOrderPayloadSchema.safeParse(momoMissingFields);
      expect(resMomoMissing.success).toBe(false);
      if (!resMomoMissing.success) {
        expect(resMomoMissing.error.issues.some((i) => i.path.includes('manualPaymentRef'))).toBe(true);
        expect(resMomoMissing.error.issues.some((i) => i.path.includes('manualPaymentPhone'))).toBe(true);
      }

      const momoInvalidPhone = {
        ...momoMissingFields,
        manualPaymentRef: 'MP261117.1234',
        manualPaymentPhone: '+33612345678',
      };
      expect(createStoreOrderPayloadSchema.safeParse(momoInvalidPhone).success).toBe(false);

      const momoValid = {
        ...momoMissingFields,
        manualPaymentRef: 'MP261117.1234',
        manualPaymentPhone: '699001122',
      };
      expect(createStoreOrderPayloadSchema.safeParse(momoValid).success).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // 4. Feature Gating & Commerce Plan Authorization
  // ------------------------------------------------------------------
  describe('Server-Side Feature Gating (Triple Verrouillage)', () => {
    it('authorizes commerce accounts and blocks free or agent accounts', () => {
      const mockCommerceCtx: any = {
        quota: {
          planSlug: 'commerce',
          subscriptionStatus: 'active',
          capabilities: { ecommerce_store: true },
        },
      };

      const mockAgentCtx: any = {
        quota: {
          planSlug: 'agent',
          subscriptionStatus: 'active',
          capabilities: { ecommerce_store: false },
        },
      };

      const mockFreeCtx: any = {
        quota: {
          planSlug: 'free',
          subscriptionStatus: 'active',
          capabilities: { ecommerce_store: false },
        },
      };

      expect(hasCommerceCapability(mockCommerceCtx)).toBe(true);
      expect(hasCommerceCapability(mockAgentCtx)).toBe(false);
      expect(hasCommerceCapability(mockFreeCtx)).toBe(false);
      expect(hasCommerceCapability(null)).toBe(false);

      expect(() => requireCommerceCapability(mockCommerceCtx)).not.toThrow();
      expect(() => requireCommerceCapability(mockAgentCtx)).toThrow(FeatureGateError);
      expect(() => requireCommerceCapability(mockFreeCtx)).toThrow(FeatureGateError);

      expect(assertCommerceApiAccess(mockCommerceCtx)).toBeNull();
      const forbiddenResponse = assertCommerceApiAccess(mockAgentCtx);
      expect(forbiddenResponse?.status).toBe(403);
    });
  });

  // ------------------------------------------------------------------
  // 5. Multi-Tenant Subdomain Extraction
  // ------------------------------------------------------------------
  describe('Multi-Tenant Subdomain Extraction Logic', () => {
    it('extracts store slug correctly from valid local and production subdomains', () => {
      const createMockReq = (host: string): NextRequest => {
        return {
          headers: new Headers({ host }),
          nextUrl: new URL(`http://${host}/`),
        } as unknown as NextRequest;
      };

      // Local development subdomains
      expect(extractStoreSubdomain(createMockReq('ma-boutique.localhost:3000'))).toBe('ma-boutique');
      expect(extractStoreSubdomain(createMockReq('oraimo-kmer.localhost'))).toBe('oraimo-kmer');

      // Production subdomains
      expect(extractStoreSubdomain(createMockReq('ma-boutique.innoica.com'))).toBe('ma-boutique');

      // Reserved subdomains must return null (handled by standard platform i18n routing)
      expect(extractStoreSubdomain(createMockReq('admin.innoica.com'))).toBeNull();
      expect(extractStoreSubdomain(createMockReq('api.innoica.com'))).toBeNull();
      expect(extractStoreSubdomain(createMockReq('www.innoica.com'))).toBeNull();
      expect(extractStoreSubdomain(createMockReq('dashboard.innoica.com'))).toBeNull();

      // Non-subdomain apex or raw IP hosts must return null
      expect(extractStoreSubdomain(createMockReq('localhost:3000'))).toBeNull();
      expect(extractStoreSubdomain(createMockReq('127.0.0.1:3000'))).toBeNull();
      expect(extractStoreSubdomain(createMockReq('preview.vercel.app'))).toBeNull();
    });

    it('blocks path traversal and malformed x-forwarded-host values in extractStoreSubdomain', () => {
      const createXfhReq = (xfh: string): NextRequest => {
        return {
          headers: new Headers({
            host: 'boutique.innoica.com',
            'x-forwarded-host': xfh,
          }),
          nextUrl: new URL('https://boutique.innoica.com/'),
        } as unknown as NextRequest;
      };

      expect(extractStoreSubdomain(createXfhReq('%2e%2e/%2e%2e/admin.innoica.com'))).toBeNull();
      expect(extractStoreSubdomain(createXfhReq('%2e%2e/%2e%2e/admin.localhost'))).toBeNull();
      expect(extractStoreSubdomain(createXfhReq('a/../admin.innoica.com'))).toBeNull();
      expect(extractStoreSubdomain(createXfhReq('a/../.boutique.innoica.com'))).toBeNull();
      expect(extractStoreSubdomain(createXfhReq('bad..slug.innoica.com'))).toBeNull();
      expect(extractStoreSubdomain(createXfhReq('evil_slug.localhost'))).toBeNull();
      expect(extractStoreSubdomain(createXfhReq('valid-shop.innoica.com'))).toBe('valid-shop');
    });
  });

  // ------------------------------------------------------------------
  // 6. Store Builder 5-Section Schema & Signed Order Receipts
  // ------------------------------------------------------------------
  describe('Visual Store Builder Layout & Guest Order Receipt Integrity', () => {
    it('accepts the 5 controlled section types and rejects unknown injection types', () => {
      const validLayout = {
        themeColor: '#00DF59',
        announcement: { enabled: true, text: 'Livraison express Douala' },
        sections: [
          { id: 'sec-hero-1', type: 'hero', visible: true, order: 0, settings: { title: 'Accueil' } },
          { id: 'sec-feat-1', type: 'features_banner', visible: true, order: 1, settings: {} },
          { id: 'sec-cat-1', type: 'catalog_grid', visible: true, order: 2, settings: { itemsLimit: 12 } },
          { id: 'sec-abt-1', type: 'about', visible: true, order: 3, settings: { contactPhone: '+237699123456' } },
          { id: 'sec-ftr-1', type: 'footer', visible: true, order: 4, settings: { copyright: '© 2026' } },
        ],
      };

      expect(storeLayoutSchema.safeParse(validLayout).success).toBe(true);
      expect(extractMerchantPhone(validLayout, null)).toBe('+237699123456');

      const maliciousLayout = {
        themeColor: '#25D366',
        sections: [
          { id: 'sec-bad', type: 'raw_iframe_injection', visible: true, order: 0, settings: {} },
        ],
      };
      expect(storeLayoutSchema.safeParse(maliciousLayout).success).toBe(false);
    });

    it('signs and verifies guest order receipt tokens while rejecting tampering or wrong order', () => {
      const token = signOrderReceipt({
        storeSlug: 'oraimo-douala',
        orderNumber: 'CMD-20261117-0001',
        orderId: '33333333-3333-3333-3333-333333333333',
        customerName: 'Marc Nkoa',
        customerPhone: '+237699123456',
        deliveryMethod: 'delivery',
        deliveryAddress: 'Douala Akwa',
        deliveryFeeXaf: 1500,
        subtotalXaf: 18500,
        totalAmountXaf: 20000,
        paymentMethod: 'cash_on_delivery',
        paymentStatus: 'pending_verification',
        items: [
          {
            id: 'item-1',
            product_title: 'FreePods 4',
            variant_title: null,
            quantity: 1,
            unit_price_xaf: 18500,
            total_price_xaf: 18500,
          },
        ],
        issuedAt: Date.now(),
      });

      const verified = verifyOrderReceipt(token, 'oraimo-douala', 'CMD-20261117-0001');
      expect(verified).not.toBeNull();
      expect(verified?.totalAmountXaf).toBe(20000);

      // Wrong store or order number must fail
      expect(verifyOrderReceipt(token, 'autre-boutique', 'CMD-20261117-0001')).toBeNull();
      expect(verifyOrderReceipt(token, 'oraimo-douala', 'CMD-20261117-9999')).toBeNull();

      // Tampered signature must fail
      const tampered = `${token.slice(0, -3)}xxx`;
      expect(verifyOrderReceipt(tampered, 'oraimo-douala', 'CMD-20261117-0001')).toBeNull();
    });

    it('hardens order receipt issuedAt validation and rejects public anon key / missing production secret', () => {
      const origEnv = { ...process.env };
      try {
        process.env.ORDER_RECEIPT_SECRET = 'server-only-test-secret';

        // Missing or NaN or future-skewed issuedAt must be rejected even if validly signed
        const signRaw = (payloadObj: any, secret: string) => {
          const payload = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
          const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
          return `${payload}.${sig}`;
        };

        const missingIssuedAt = signRaw(
          { storeSlug: 'oraimo-douala', orderNumber: 'CMD-20261117-0001' },
          'server-only-test-secret'
        );
        expect(verifyOrderReceipt(missingIssuedAt, 'oraimo-douala', 'CMD-20261117-0001')).toBeNull();

        const futureIssuedAt = signRaw(
          {
            storeSlug: 'oraimo-douala',
            orderNumber: 'CMD-20261117-0001',
            issuedAt: Date.now() + 5 * 60 * 1000,
          },
          'server-only-test-secret'
        );
        expect(verifyOrderReceipt(futureIssuedAt, 'oraimo-douala', 'CMD-20261117-0001')).toBeNull();

        // Token signed with NEXT_PUBLIC_SUPABASE_ANON_KEY must NOT be accepted
        delete process.env.ORDER_RECEIPT_SECRET;
        delete process.env.ENCRYPTION_MASTER_KEY;
        delete process.env.WORKER_INTERNAL_SECRET;
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'public-anon-key';
        const forgedWithAnon = signRaw(
          {
            storeSlug: 'oraimo-douala',
            orderNumber: 'CMD-20261117-0001',
            issuedAt: Date.now(),
          },
          'public-anon-key'
        );
        expect(verifyOrderReceipt(forgedWithAnon, 'oraimo-douala', 'CMD-20261117-0001')).toBeNull();

        // Production without server secret must throw
        (process.env as any).NODE_ENV = 'production';
        expect(() =>
          verifyOrderReceipt(forgedWithAnon, 'oraimo-douala', 'CMD-20261117-0001')
        ).toThrow();
      } finally {
        process.env = origEnv;
      }
    });
  });
});

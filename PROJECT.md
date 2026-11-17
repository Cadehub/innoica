# Project: INNOICA WhatsApp Agent — Évolution Stratégique Production (Images Baileys, Offres & E-Commerce Natif)

## Architecture
INNOICA WhatsApp Agent Studio est un monorepo pnpm articulé autour des modules suivants :
- `apps/web` : Frontend Next.js 15.1.7 (React 19, Tailwind CSS 3.4.17, next-intl, App Router) assurant l'espace commerçant, l'administration, la landing page, et désormais le Storefront public (`/store/[slug]`) et le Constructeur Visuel de boutique.
- `services/whatsapp-worker` : Service Node.js / Baileys v7.0.0-rc14 gérant les sockets WhatsApp, la réception/déchiffrement des strophes, l'extraction binaire des médias (audio, images), la gestion mémoire zéro-disque et l'envoi de messages WhatsApp.
- `services/ai-runtime` : Moteur d'orchestration Fastify / IA appelant les modèles multimodaux (Google Gemini, OpenAI, OpenRouter) et modèles textuels (Groq), avec injection de contexte, vérification de capacité de vision et directives anti-hallucination.
- `packages/database` : Schémas SQL Supabase (PostgreSQL 17), migrations versionnées, fonctions de calcul et politiques RLS multi-tenant étanches basées sur `workspace_id`.
- `packages/shared` : Types TypeScript universels, constantes de tarification (`PLAN_CATALOG`), schémas Zod et messages multilingues.

```
[ Client WhatsApp ] <== WebSocket / Baileys ==> [ whatsapp-worker ]
                                                       │
                                            (HTTP / In-Memory Buffer)
                                                       │
                                                       ▼
[ Storefront Public / Web ] <== Supabase RLS ==> [ ai-runtime ] <== Vision Directives ==> [ Modèles IA ]
         │                                             │                               (Gemini, OpenAI,
         ▼                                             ▼                                OpenRouter)
[ Supabase PostgreSQL 17 ] <== create_store_order RPC == Native E-Commerce (Orders, Products, RLS)
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Extraction d'images Baileys | Réception et extraction sans perte des images JPEG/PNG/WebP avec/sans légende via Baileys | M1 | R1 |
| F2 | Pipeline Multimodal & Sécurité | Transmission base64 aux modèles Vision (Gemini/OpenAI/OpenRouter), zéro exposition d'URL publique, nettoyage mémoire `buffer.fill(0)` | M1 | R1 |
| F3 | Refus explicite non-vision & Anti-hallucination | Message explicite si le modèle ne supporte pas Vision ; comparaison catalogue sans hallucination prix/stock | M1 | R1 |
| F4 | Nouvelles offres commerciales | INNOICA Agent à 3 500 FCFA/mois (37 800/an) et INNOICA Commerce à 6 500 FCFA/mois (70 200/an) | M2 | R2 |
| F5 | Feature Gating Serveur | Capacité `ecommerce_store` bloquée côté serveur pour Agent et autorisée pour Commerce (Page, API, RLS) | M2 | R2 |
| F6 | Non-régression abonnements | Préservation des abonnements existants (`starter` grandfathered) et transactions passées | M2 | R2 |
| F7 | Schéma E-Commerce Natif Multi-Tenant | 10 tables e-commerce étanches avec isolation `workspace_id` et politiques RLS | M3 | R3 |
| F8 | Recalcul serveur & Stocks atomiques | RPC `create_store_order` recalculant sous-total, livraison et total avec verrouillage stock (`SELECT FOR UPDATE`) | M3 | R3 |
| F9 | Storefront Public Oraimo-Style | Vitrine responsive : bannières hero, grille filtrable, fiches produits avec galerie/spécifications, panier | M4 | R4 |
| F10 | Constructeur Visuel Sécurisé Anti-XSS | Builder commerçant avec composants contrôlés structurés JSON (Zod), aperçu en direct, brouillon/publication | M4 | R4 |
| F11 | Routage Multi-Tenant Hybride | Support combiné chemin canonique `/store/[slug]` et réécriture d'hôte sous-domaine dans le middleware | M4 | R4 |
| F12 | Gestion Commerciale & Zones | Configuration commerçant des zones/délais de livraison et retraits sur place | M5 | R5 |
| F13 | Paiements Manuels & Validation Humaine | Paiement livraison, retrait ou Mobile Money manuel avec état `pending_verification` avant validation humaine | M5 | R5 |
| F14 | Synchronisation Baileys Catalogue & Commandes | Interrogation catalogue en temps réel par l'agent WhatsApp et notifications commandes idempotentes | M5 | R5 |
| F15 | Super Admin Privacy-Preserving | Métriques agrégées réelles (boutiques, commandes, abonnements) via RPC SECURITY DEFINER sans fuite de PII | M5 | R5 |
| F16 | Validation E2E & Durcissement Adversarial | Exécution de la suite E2E complète (Tiers 1-4) puis durcissement Tier 5 | M6 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | WhatsApp Incoming Image Understanding (Baileys + Multimodal Vision) | `whatsapp-worker` (image handler, binary buffer), `ai-runtime` (multimodal vision adapters, fallback error, anti-hallucination prompt), `database` (message_type check constraint, image_metadata), `shared` (types, constants) | none | DONE |
| M2 | Commercial Offers & Server-Side Feature Gating | `shared` (`PLAN_CATALOG`, types, schemas), `database` (plans table, grandfathering starter), `apps/web` (landing, subscription, declare route, admin plans, feature gate) | M1 | DONE |
| M3 | Native Multi-Tenant E-Commerce Engine & Supabase RLS | `database` (10 tables e-commerce, RLS, indexes, `create_store_order` RPC), `shared` (schemas, types) | M2 | DONE |
| M4 | Public Storefront (Oraimo Style) & Visual Store Builder | `apps/web` (routing `/store/[slug]` + middleware rewrite, public storefront pages, store builder JSON, preview) | M3 | IN_PROGRESS |
| M5 | Commercial Management, Baileys Realtime Sync & Super Admin | `apps/web` (merchant store/products/orders/shipping, super admin aggregates RPC), `whatsapp-worker` (catalog lookup tool & idempotent order notifications) | M4 | PLANNED |
| M6 | E2E Integration & Verification | 100% test pass sur Tiers 1-4 puis durcissement adversarial Tier 5 | M1, M2, M3, M4, M5, TEST_READY.md | PLANNED |

## Interface Contracts
### `whatsapp-worker` ↔ `ai-runtime`
- **Endpoint**: `POST /api/generate-response`
- **Request Payload**:
  ```typescript
  {
    agentId: string;
    conversationId: string;
    contactPhoneNumber: string;
    replyJid?: string;
    incomingMessage: string; // Caption or empty string
    incomingMessageType: 'text' | 'audio' | 'image';
    imageContext?: {
      mimeType: string;
      base64Data: string;
      caption?: string;
    };
    idempotencyKey?: string;
  }
  ```
- **Error Response**: Explicit fallback message if `isVision === false` or image invalid.

### `apps/web` / Public Storefront ↔ Supabase RPC
- **Function**: `public.create_store_order(p_store_slug TEXT, p_customer_name TEXT, p_customer_phone TEXT, p_delivery_zone_id UUID, p_delivery_method TEXT, p_delivery_address TEXT, p_payment_method TEXT, p_items JSONB, p_manual_payment_ref TEXT, p_manual_payment_phone TEXT, p_delivery_notes TEXT)`
- **Returns**: `JSONB` with `{ ok: true, orderId: uuid, orderNumber: string, subtotalXaf: number, deliveryFeeXaf: number, totalXaf: number, paymentStatus: string }`

### `apps/web` ↔ Store Builder Configuration
- **Schema**: `storeLayoutSchema` (Zod) validating structured JSON:
  - `themeColor`: hex code string
  - `sections`: Array of `{ id: string, type: 'hero' | 'catalog_grid' | 'features_banner' | 'about' | 'footer', visible: boolean, order: number, settings: Record<string, unknown> }`
  - No executable scripts, raw HTML, or remote script injections permitted.

## Code Layout
- `apps/web/src/app/[locale]/(dashboard)/store/` : Espace Commerçant ("Ma boutique", builder, products, orders, shipping)
- `apps/web/src/app/[locale]/store/[storeSlug]/` : Vitrine publique Oraimo-style (accueil, catalogue, produit, panier, checkout)
- `services/whatsapp-worker/src/handlers/image-handler.ts` : Extraction binaire, magic bytes, validation média
- `services/whatsapp-worker/src/handlers/message-handler.ts` : Dispatcher de messages WhatsApp
- `services/ai-runtime/src/adapters/` : Adapteurs LLM multimodaux (Gemini inlineData, OpenAI/OpenRouter content parts)
- `packages/database/migrations/` : Migrations PostgreSQL pour vision, tarification et e-commerce

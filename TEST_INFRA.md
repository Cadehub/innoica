# E2E Test Infra: INNOICA WhatsApp Agent & Native E-Commerce

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.
- Strict isolation of test data and zero pollution of production workspace.

## Feature Inventory Test Mapping
| # | Feature | Source (Requirement) | Tier 1 (Coverage >=5) | Tier 2 (Boundary >=5) | Tier 3 (Pairwise) | Tier 4 (Workload) |
|---|---------|----------------------|:---------------------:|:---------------------:|:-----------------:|:-----------------:|
| F1-F3 | Compréhension Images Baileys & Vision Multimodale | R1 | 5 | 5 | ✓ | ✓ |
| F4-F6 | Nouvelles Offres Commerciales & Feature Gating | R2 | 5 | 5 | ✓ | ✓ |
| F7-F8 | Moteur E-Commerce Natif & Isolation Multi-Tenant RLS | R3 | 5 | 5 | ✓ | ✓ |
| F9-F11 | Storefront Public Oraimo & Constructeur Visuel | R4 | 5 | 5 | ✓ | ✓ |
| F12-F15 | Gestion Commerciale, Paiements Manuels & Super Admin | R5 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Test Runner**: Vitest (Node.js/TypeScript) exécuté depuis le monorepo :
  `pnpm test` ou ciblé `pnpm vitest run tests/`
- **Pass/Fail Semantics**: 100% passing tests, exit code 0. Aucun test ignoré ou feint.
- **Directory Layout**:
  - `tests/e2e/multimodal-vision.test.ts` : Tests Tiers 1-4 pour la réception et compréhension des images WhatsApp.
  - `tests/e2e/pricing-feature-gating.test.ts` : Tests Tiers 1-4 pour les plans 3 500 / 6 500 FCFA et le blocage serveur.
  - `tests/e2e/native-ecommerce-rls.test.ts` : Tests Tiers 1-4 pour l'isolation multi-tenant, calcul serveur et stocks.
  - `tests/e2e/storefront-builder.test.ts` : Tests Tiers 1-4 pour le constructeur sécurisé JSON et la vitrine publique.
  - `tests/e2e/commercial-super-admin.test.ts` : Tests Tiers 1-4 pour les paiements manuels, notifications Baileys et métriques Super Admin.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| S1 | Client envoie photo d'un produit par WhatsApp -> Agent identifie le produit du catalogue et renvoie stock/prix réel sans hallucination -> Client commande | F1, F2, F3, F7, F14 | High |
| S2 | Commerçant souscrit à INNOICA Commerce (6 500 FCFA) -> configure sa boutique dans le Store Builder -> publie sa vitrine -> reçoit commande en paiement Mobile Money | F4, F5, F7, F9, F10, F13 | High |
| S3 | Utilisateur INNOICA Agent (3 500 FCFA) tente d'accéder au store builder ou de créer un produit -> Rejet immédiat HTTP 403 / redirection côté serveur | F4, F5 | Medium |
| S4 | Deux commerçants distincts gèrent leurs boutiques en parallèle -> Isolation RLS totale vérifiée, aucune fuite de catalogue ou commande entre tenants | F7, F8, F12 | High |
| S5 | Super Admin consulte le dashboard -> visualise les métriques agrégées globales sans voir les données privées (PII) des clients ou boutiques | F15 | Medium |

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: ≥5 tests par groupe de fonctionnalités (>= 25 tests)
- **Tier 2 (Boundary & Corner Cases)**: ≥5 tests par groupe de fonctionnalités (>= 25 tests)
- **Tier 3 (Cross-Feature Combinations)**: Couverture pairwise des interactions majeures (>= 10 tests)
- **Tier 4 (Real-World Application Scenarios)**: ≥5 scénarios réels complets de bout en bout
- **Total Minimum**: ≥ 65 tests de qualification E2E

# INNOICA WhatsApp Agents — Feuille de route & État d'avancement (PROGRESS)

**Version cible :** 2.0  
**Dernière mise à jour :** 14 Novembre 2026

---

## Vue d'ensemble des Jalons

| Jalon | Intitulé | Statut |
|---|---|---|
| **Phase 0** | Cadrage, Documentation & Initialisation Monorepo | 🔄 En cours |
| **Phase 1** | Schéma Base de Données Supabase & RLS Stricte | ⏳ En attente |
| **Phase 2** | Service WhatsApp Worker (Baileys Pairing Code Only) | ⏳ En attente |
| **Phase 3** | Service AI Runtime (BYOK, Prompts, Mémoire, Human Handoff) | ⏳ En attente |
| **Phase 4** | Service Ingestion Worker (Documents, FAQ, Web SSRF-safe) | ⏳ En attente |
| **Phase 5** | Dashboard Client (Next.js 15, Tailwind, shadcn/ui, next-intl) | ⏳ En attente |
| **Phase 6** | Panel Super Admin INNOICA (Supervision & Plans) | ⏳ En attente |
| **Phase 7** | Tests E2E, Déploiement VPS Contabo & Durcissement | ⏳ En attente |

---

## Détail des Tâches par Phase

### Phase 0 : Initialisation & Socle
- [x] Spécification de référence v2.0 archivée (`docs/PRODUCT_SPEC.md`)
- [x] Décisions d'architecture arrêtées (`docs/DECISIONS.md`)
- [x] Initialisation Git du dépôt
- [ ] Documentation d'architecture complète (`docs/ARCHITECTURE.md`, `docs/WHATSAPP_PAIRING.md`, etc.)
- [ ] Initialisation de la structure Monorepo pnpm (`pnpm-workspace.yaml`, `package.json`, tsconfig, linting)
- [ ] Création du package partagé `@innoica/shared` (types, schémas, constantes)

### Phase 1 : Base de Données Supabase
- [ ] Création / configuration du schéma de base de données PostgreSQL
- [ ] Définition des tables (workspaces, profiles, agents, connections, messages, memories, etc.)
- [ ] Configuration des politiques RLS (Row Level Security) multi-tenant étanches
- [ ] Triggers de mise à jour et audit logs
- [ ] Chiffrement AES-256-GCM pour les secrets (clés API & sessions)

### Phase 2 : WhatsApp Worker (Baileys Pairing Code)
- [ ] Service Node.js / Baileys autonome
- [ ] API de demande de Pairing Code (`sock.requestPairingCode`)
- [ ] Validation et normalisation stricte du numéro international
- [ ] Système d'isolation des sessions multi-agents
- [ ] Événements de synchronisation d'état vers Supabase / Redis
- [ ] Détection et reconnexion automatique en cas de rupture de session
- [ ] **Validation stricte : Zéro trace de code ou de composant QR**

### Phase 3 : AI Runtime & Mémoire
- [ ] Connecteurs BYOK multi-fournisseurs (OpenRouter, Groq, Gemini, OpenAI)
- [ ] Gestion des modèles d'agents (Receptionist, Sales, Support, Booking, Restaurant, Custom)
- [ ] Gestionnaire de mémoire (court terme conversation + durable contact)
- [ ] Contrôle humain à triple état (`AI Active`, `Human Takeover`, `Paused`) avec vérification atomique
- [ ] Système anti-boucle et déduplication des messages

### Phase 4 : Ingestion Worker & Base de Connaissances
- [ ] Ingestion de FAQ manuelles
- [ ] Parseurs de documents sécurisés (PDF, TXT) avec quotas de taille
- [ ] Scraping d'URL publiques avec protection SSRF stricte (blocage LAN, RFC 1918, timeouts)
- [ ] Découpage en fragments (chunks) et indexation vectorielle ou texte

### Phase 5 : Dashboard Client Next.js
- [ ] Authentification Supabase Auth (FR / EN avec `next-intl`)
- [ ] Gestion des Workspaces et profil utilisateur
- [ ] Création et gestion complète des Agents (formulaires Zod, étapes fluides)
- [ ] Écran d'appairage WhatsApp par Pairing Code (champs téléphone, affichage du code à 8 chiffres)
- [ ] Boîte de réception conversationnelle temps réel (inbox, historique, reprise manuelle)
- [ ] Gestion des connaissances et configuration des clés IA personnelles
- [ ] Vue d'ensemble avec métriques 100% réelles

### Phase 6 : Panel Super Admin INNOICA
- [ ] Accès sécurisé par rôle Super Admin (bootstrap vérifié)
- [ ] Supervision globale des workspaces, agents et connexions WhatsApp
- [ ] Gestion des plans d'abonnement et quotas serveurs
- [ ] Consultation des logs d'erreurs et audit des opérations

### Phase 7 : Déploiement & Tests
- [ ] Configuration Dockerfile & docker-compose pour VPS Contabo
- [ ] Tests unitaires et d'intégration
- [ ] Tests E2E Playwright
- [ ] Audit de sécurité final

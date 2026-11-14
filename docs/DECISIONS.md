# INNOICA WhatsApp Agents — Architecture & Foundation Decisions

**Date de validation :** 14 Novembre 2026  
**Version :** 2.0  
**Statut :** Décisions arrêtées — Ne pas remettre en question sans directive explicite.

---

## 1. Dépôt & Structure du projet
- **Décision :** Nouveau dépôt propre et indépendant (`innoica wa agent`).
- **Structure retenue :** Architecture Monorepo moderne gérée avec `pnpm workspaces` :
  - `apps/web` : Dashboard client & panel Super Admin (Next.js 15+ App Router, TypeScript strict, Tailwind CSS, shadcn/ui, next-intl FR/EN).
  - `services/whatsapp-worker` : Service Node.js / Baileys pour la gestion des sessions WhatsApp, émission des Pairing Codes, écoute et émission des messages.
  - `services/ai-runtime` : Moteur d'orchestration IA, RAG, mémoires et exécution BYOK.
  - `services/ingestion-worker` : Extraction documentaire (PDF, TXT, FAQ, scraping URL protégé SSRF) et découpage/indexation.
  - `packages/shared` : Types TypeScript partagés, schémas Zod, constantes et contrats d'API.
  - `packages/database` : Schémas Supabase, migrations SQL et utilitaires RLS.

## 2. Appairage WhatsApp — Règle Zéro QR Code
- **Décision :** Appairage exclusivement via **Pairing Code** Baileys (`sock.requestPairingCode(cleanPhoneNumber)`).
- **Règle absolue :**
  - Aucun QR Code dans l'interface, aucun composant de rendu QR, aucune bibliothèque (`qrcode`, `qr-scanner`, etc.).
  - Aucun fallback QR Code en cas d'erreur.
  - Le Pairing Code n'est jamais généré par le frontend, uniquement par le worker WhatsApp.
  - Le Pairing Code est éphémère (expiration automatique WhatsApp) et dispose d'une protection contre le spam / re-demandes abusives.

## 3. Fournisseurs IA — BYOK (Bring Your Own Key)
- **Décision :** Le client fournit sa propre clé API (OpenRouter, Groq, Google Gemini, OpenAI).
- **Sécurité des clés :**
  - Chiffrement symétrique côté serveur (AES-256-GCM) avec clé maîtresse secrète `ENCRYPTION_MASTER_KEY` conservée hors base de données.
  - Aucune clé API exposée au frontend après saisie initiale.
  - Jamais de clé dans les logs d'erreurs ou dans le prompt du LLM.
  - Pas de fallback silencieux vers une clé globale payante.

## 4. Base de Données & Source de Vérité
- **Décision :** **Supabase (PostgreSQL 17)** est l'unique source de vérité.
- **Sécurité des données :**
  - Row Level Security (RLS) obligatoire sur toutes les tables de données client.
  - Isolation stricte multi-workspace : un utilisateur ne peut accéder qu'aux données des workspaces dont il est membre.
  - Redis + BullMQ sert de file d'attente asynchrone et de coordination d'événements, jamais de source de vérité persistante.

## 5. Mémoire et Contrôle Humain (Human Takeover)
- **Mémoire à double niveau :**
  1. *Mémoire de conversation* : historique contextuel de l'échange immédiat.
  2. *Mémoire durable de contact* : préférences et notes synthétiques par contact.
- **Règle de sécurité Human Takeover :**
  - 3 modes stricts : `AI Active`, `Human Takeover`, `Paused`.
  - Si un humain intervient manuellement, l'agent passe immédiatement en `Human Takeover` et bloque toute génération IA future.
  - Le runtime IA effectue une **double vérification atomique** du mode juste avant d'émettre le message sur WhatsApp pour éviter toute course critique (race condition).

## 6. Déploiement Contabo VPS & Microservices
- **Hébergement :** VPS Contabo dédié avec Docker & Docker Compose.
- **Conteneurs :**
  - `innoica-web`
  - `innoica-whatsapp-worker`
  - `innoica-ai-runtime`
  - `innoica-ingestion-worker`
  - `innoica-queue` (Redis)
  - `innoica-reverse-proxy` (Caddy ou Nginx avec SSL automatique)

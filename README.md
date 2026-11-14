# INNOICA WhatsApp Agents

> **Slogan :** *Turn Complexity Into Simplicity*  
> **Version :** 2.0 (Spécification de référence)  
> **Zone :** Cameroun et marché international  
> **Devise :** XAF / FCFA — **Fuseau horaire :** Africa/Douala

---

## 🎯 Vision du Produit

**INNOICA WhatsApp Agents** est une plateforme SaaS permettant aux entreprises et aux indépendants de concevoir, déployer et administrer des agents d'intelligence artificielle spécialisés connectés directement à leurs numéros WhatsApp via Baileys.

---

## 🔒 Principes Fondamentaux & Règles Non Négociables

1. **Appairage WhatsApp :**
   - **Méthode exclusive :** **Pairing Code** (`sock.requestPairingCode`).
   - **Règle absolue :** **STRICTEMENT AUCUN QR CODE** (aucun composant, aucun scan, aucune lib, aucun QR de secours).
   - **Attribution :** Saisie manuelle au format international (+237...). 1 numéro = 1 agent.
2. **Intelligence Artificielle :**
   - Modèle **BYOK (Bring Your Own Key)** : l'utilisateur utilise sa propre clé API (OpenRouter, Groq, Google Gemini, OpenAI).
   - Chiffrement AES-256-GCM côté serveur avec clé maîtresse hors base de données.
3. **Mémoire & Contrôle Humain :**
   - Mémoire contextuelle de conversation + Mémoire durable par contact.
   - 3 modes stricts : `AI Active`, `Human Takeover`, `Paused`.
   - Double vérification atomique avant envoi pour garantir la priorité absolue de l'humain.
4. **Base de Données & Source de Vérité :**
   - **Supabase (PostgreSQL 17)** avec Row Level Security (RLS) et isolation multi-workspace étanche.
5. **Hébergement :**
   - VPS Contabo (services conteneurisés Docker : Web, WhatsApp Worker, AI Runtime, Ingestion Worker, Redis/BullMQ, Reverse Proxy).

---

## 📂 Structure du Répertoire Monorepo

```
innoica-wa-agent/
├── apps/
│   └── web/                   # Next.js 15 App Router (Dashboard & Super Admin)
├── services/
│   ├── whatsapp-worker/       # Baileys Socket Manager (Pairing Code only)
│   ├── ai-runtime/            # Orchestration BYOK, Prompts & Double Handoff Check
│   └── ingestion-worker/      # Extraction PDF/TXT, Scraping URL anti-SSRF & RAG
├── packages/
│   ├── shared/                # Types TS partagés, schémas Zod, constantes
│   └── database/              # Schémas Supabase, migrations SQL et seed
├── docs/                      # Documentation officielle obligatoire
│   ├── PRODUCT_SPEC.md        # Cahier des charges v2.0 complet
│   ├── ARCHITECTURE.md        # Diagrammes et architecture globale
│   ├── DECISIONS.md           # Registre des décisions fondatrices
│   ├── DATABASE_SCHEMA.md     # Schéma PostgreSQL et politiques RLS
│   ├── WHATSAPP_PAIRING.md    # Protocole Pairing Code (Zéro QR Code)
│   └── PROGRESS.md            # Feuille de route et suivi d'avancement
└── package.json               # Racine Monorepo pnpm
```

---

## 📚 Documentation

Pour consulter les spécifications détaillées, veuillez vous référer aux fichiers du dossier [docs/](file:///c:/Users/UltraBook%203.1/Desktop/innoica%20wa%20agent/docs):
- [Cahier des charges complet v2.0](file:///c:/Users/UltraBook%203.1/Desktop/innoica%20wa%20agent/docs/PRODUCT_SPEC.md)
- [Architecture & Flux](file:///c:/Users/UltraBook%203.1/Desktop/innoica%20wa%20agent/docs/ARCHITECTURE.md)
- [Protocole Pairing Code](file:///c:/Users/UltraBook%203.1/Desktop/innoica%20wa%20agent/docs/WHATSAPP_PAIRING.md)
- [Schéma Base de Données](file:///c:/Users/UltraBook%203.1/Desktop/innoica%20wa%20agent/docs/DATABASE_SCHEMA.md)
- [Décisions d'Architecture](file:///c:/Users/UltraBook%203.1/Desktop/innoica%20wa%20agent/docs/DECISIONS.md)
- [Feuille de Route](file:///c:/Users/UltraBook%203.1/Desktop/innoica%20wa%20agent/docs/PROGRESS.md)

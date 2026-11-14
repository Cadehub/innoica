# INNOICA WhatsApp Agents — Spécification d'Architecture Technique

**Version :** 2.0  
**Statut :** Spécification de référence

---

## 1. Vue d'ensemble du système

```mermaid
flowchart TB
    subgraph ClientLayer ["Couche Utilisateur & Dashboard"]
        UserBrowser["Navigateur Client / Admin"]
        NextApp["innoica-web (Next.js 15 App Router)\n- Dashboard Client\n- Panel Super Admin\n- FR / EN (next-intl)"]
    end

    subgraph DataLayer ["Couche de Données & Vérité (Supabase Cloud / VPS)"]
        SupaAuth["Supabase Auth"]
        SupaDB[("PostgreSQL 17\n+ RLS + pgvector")]
        SupaStorage["Supabase Storage\n(Documents PDF / TXT)"]
        SupaRealtime["Supabase Realtime\n(Statuts & Messages)"]
    end

    subgraph VPSLayer ["Services VPS Contabo (Docker Compose)"]
        ReverseProxy["innoica-reverse-proxy (Caddy / Nginx SSL)"]
        Queue["innoica-queue (Redis 7 + BullMQ)"]
        
        WAWorker["innoica-whatsapp-worker\n(Node.js + Baileys)\n- Pairing Code Only\n- Session Isolation\n- Socket Management"]
        
        AIRuntime["innoica-ai-runtime\n(Node.js)\n- BYOK Orchestration\n- Double-Check Human Mode\n- Dual Memory (Chat + Contact)"]
        
        IngestionWorker["innoica-ingestion-worker\n- Extraction PDF/TXT/FAQ\n- Safe Web Fetch (Anti-SSRF)\n- Chunking & Indexing"]
    end

    subgraph ExternalServices ["Services Externes"]
        WhatsAppNetwork["Réseau WhatsApp (Meta)"]
        AIProviders["Fournisseurs IA (BYOK)\n- OpenRouter\n- Groq\n- Google Gemini\n- OpenAI"]
    end

    UserBrowser <--> ReverseProxy
    ReverseProxy <--> NextApp
    NextApp <--> SupaAuth
    NextApp <--> SupaDB
    NextApp <--> SupaRealtime

    NextApp -- "Ordre de Pairing / Envoi Manuel" --> Queue
    Queue <--> WAWorker
    Queue <--> AIRuntime
    Queue <--> IngestionWorker

    WAWorker <--> WhatsAppNetwork
    WAWorker -- "Événements Messages" --> Queue
    AIRuntime <--> AIProviders
    AIRuntime <--> SupaDB
    IngestionWorker <--> SupaStorage
    IngestionWorker <--> SupaDB
```

---

## 2. Découpage des Composants et Responsabilités

### 2.1 `apps/web` (Application Web & API routes Next.js)
- **Rôle :** Interface utilisateur SaaS, gestion des workspaces, configuration des agents, monitoring, boîte de réception humaine, administration.
- **Règles :**
  - Aucune clé API stockée en clair côté client.
  - Saisie du numéro WhatsApp avec validation internationale E.164.
  - Réception en temps réel des Pairing Codes générés par le Worker.
  - Contrôle d'accès strict via RLS Supabase et vérifications serveurs.

### 2.2 `services/whatsapp-worker`
- **Rôle :** Gestionnaire de sockets WhatsApp via la bibliothèque Baileys.
- **Fonctionnalités :**
  - Initialisation de session isolée par agent.
  - Exécution de `sock.requestPairingCode(phoneNumber)` à la demande.
  - Émission du code temporaire à 8 caractères vers Supabase/Redis pour affichage client.
  - Écoute des messages entrants (`messages.upsert`).
  - Déduplication via identifiant de message WhatsApp (`msg.key.id`).
  - Envoi des messages sortants (`sock.sendMessage`).
- **Garantie absolue :** Aucun QR Code n'est jamais demandé, calculé ou stocké.

### 2.3 `services/ai-runtime`
- **Rôle :** Cerveau d'orchestration conversationnelle.
- **Fonctionnalités :**
  - Dépouillement des messages depuis la file BullMQ.
  - Vérification de l'état de l'agent (`active` uniquement).
  - **Vérification 1 :** Contrôle du mode de conversation (`Human Takeover` => interruption immédiate).
  - Récupération du contexte : instructions système du modèle + mémoire de conversation récente + mémoire durable du contact.
  - Recherche sémantique dans les fragments de connaissances associés.
  - Appel au fournisseur d'IA configuré via le connecteur BYOK correspondant.
  - **Vérification 2 :** Re-vérification atomique du mode conversation avant envoi vers la file d'émission pour éviter toute réponse tardive en cas de prise de contrôle humaine concurrente.

### 2.4 `services/ingestion-worker`
- **Rôle :** Traitement documentaire asynchrone pour la base de connaissances.
- **Fonctionnalités :**
  - Extraction de texte à partir de PDF et fichiers TXT.
  - Scraping d'URL publiques avec module de validation SSRF strict (rejet immédiat de toute IP locale, privée, link-local, loopback, ou métadonnées cloud).
  - Découpage en fragments cohérents (chunking) et stockage dans PostgreSQL.

---

## 3. Flux d'un message entrant (Séquence pas-à-pas)

```mermaid
sequenceDiagram
    autonumber
    actor Client as Contact WhatsApp
    participant WA as Baileys Worker
    participant Queue as Redis / BullMQ
    participant AI as AI Runtime
    participant DB as Supabase DB
    participant LLM as Provider IA (BYOK)
    actor Human as Opérateur Humain (Dashboard)

    Client->>WA: Envoie un message texte
    WA->>WA: Valide et filtre (anti-broadcast, anti-self)
    WA->>Queue: Événement INCOMING_MESSAGE (idempotent)
    Queue->>DB: Enregistre le message (status: received)
    Queue->>AI: Traitement du message

    AI->>DB: Vérifie état Agent et Mode Conversation
    alt Mode == Human Takeover OU Paused
        AI->>AI: Arrêt immédiat du traitement IA
    else Mode == AI Active
        AI->>DB: Charge instructions, mémoire contact & chunks connaissances
        AI->>LLM: Appel API avec clé chiffrée déchiffrée en mémoire volatile
        LLM-->>AI: Réponse générée
        
        AI->>DB: Double-check : Le mode est-il toujours "AI Active" ?
        alt Si un humain a pris le relais entre-temps
            AI->>AI: Annulation de l'envoi de la réponse
        else Toujours AI Active
            AI->>Queue: Événement OUTGOING_MESSAGE
            Queue->>WA: Envoie sur WhatsApp
            WA->>Client: Message délivré
            WA->>DB: Enregistre message sortant (status: sent)
        end
    end
```

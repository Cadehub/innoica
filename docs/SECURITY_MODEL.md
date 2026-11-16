# Innoica Agent Studio — Modèle de Sécurité & Conformité

**Version :** 2.1  
**Statut :** Appliqué & Vérifié  

---

## 1. Isolation Multi-Tenant & Contrôle d'Accès

1. **Row Level Security (RLS) sur 100 % des 24 tables :**
   - Chaque lecture/écriture client passe par les politiques RLS appuyées sur `public.is_workspace_member(workspace_id)` et `public.is_super_admin()`.
   - Toute table sensible (secrets internes travailleurs dans le schéma `private`) est inaccessible aux rôles `anon` et `authenticated`.
2. **Contrôle Serveur Systématique des Plans & Quotas :**
   - Aucune limite commerciale n'est vérifiée uniquement côté navigateur.
   - Création d'agent (`/api/agents`), ajout de connaissance (`/api/knowledge/*`), appairage (`/api/whatsapp/pair`), attribution du plan, application du watermark et réservation de quota (`reserve_ai_reply_quota`) sont tous validés côté serveur en base de données.
3. **Protection du Panel Super Admin (`/admin`, `/api/admin`) :**
   - Vérification `profiles.is_super_admin === true` côté serveur.
   - Toutes les actions administratives (approbation de paiement, suspension workspace/compte, modification de plan ou de domaine watermark) sont journalisées dans `audit_logs`.

---

## 2. Sécurité Cryptographique BYOK (`ENCRYPTION_MASTER_KEY`)

- Les clés API fournies par les clients sont chiffrées côté serveur via **AES-256-GCM** (`packages/shared/src/security/encryption.ts`) avec vecteur d'initialisation aléatoire et auth tag d'intégrité (format `iv:authTag:ciphertext`).
- Seul le masque `key_hint` (ex. `sk-...9f4a`) est renvoyé à l'interface client.
- Les clés ne sont jamais journalisées dans `execution_logs` ou la console.

---

## 3. Sécurité des Communications Inter-Services

- `WORKER_INTERNAL_SECRET` partagé via `.env` / `.env.local` entre `apps/web`, `services/whatsapp-worker`, `services/ai-runtime`, `services/ingestion-worker` et vérifié via hachage SHA-256 côté PostgreSQL (`private.is_authorized_worker`).
- Les routes internes des workers refusent les appels non authentifiés (`401/403`) dès que le secret est configuré.

---

## 4. Protection SSRF & Prompt Injection

1. **Anti-SSRF (`safeFetchPublicUrl` dans `packages/shared/src/security/ssrf.ts`) :**
   - Autorise uniquement `http:` et `https:`.
   - Résout le DNS avant connexion et bloque loopback (`127.0.0.0/8`, `localhost`, `::1`), IP privées RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local / métadonnées cloud (`169.254.0.0/16`), CGNAT (`100.64.0.0/10`), multicast/réservées.
   - Valide manuellement chaque saut de redirection (`redirect: 'manual'`), avec timeout de 10 s et plafond de 5 Mo.
2. **Validation PDF (`packages/shared/src/knowledge/pdf.ts`) :**
   - Contrôle strict de la signature binaire `%PDF-` et plafond de 10 Mo avant extraction.
3. **Défense contre l'Injection de Prompt (`sanitizeKnowledgeContent`) :**
   - Suppression des octets nuls (`\u0000`) et neutralisation des balises `<system>`, `<instructions>`, `<untrusted_knowledge>`, `<connaissances_autorisees>`.
   - Encadrement explicite des extraits RAG en tant que données non fiables.

---

## 5. Politique Zéro QR Code

- `printQRInTerminal: false` dans `services/whatsapp-worker`.
- Aucune dépendance ni composant QR dans tout le monorepo ; l'appairage passe exclusivement par `requestPairingCode()`.

---

## 6. Sécurité & Confidentialité du Pipeline Audio (`services/speech-worker`)

1. **Contrôle d'accès commercial avant téléchargement :** sur un compte Free (`hasVoiceUnderstanding = false`), `services/whatsapp-worker` n'appelle jamais `downloadMediaMessage` et ne télécharge aucun binaire audio.
2. **Validation binaire & taille :** contrôle préalable des métadonnées (`10 Mo` max, `300 s` max), puis inspection magic-bytes (`OggS`, `RIFF/WAVE`, `fLaC`, `ID3`/MPEG, `ftyp`, EBML WebM) et contrôle MIME avant décodage PyAV en mémoire.
3. **Protection contre la saturation & fuite mémoire :** sémaphore de concurrence (`VOICE_MAX_CONCURRENCY`), file bornée (`VOICE_MAX_QUEUE`), timeout d'exécution (`VOICE_TRANSCRIBE_TIMEOUT_SEC`), remise à zéro et libération explicite des tampons audio dans `finally`, et aucune journalisation du contenu audio ou des transcriptions.
4. **Sécurité des actions sensibles :** les intentions `order`, `booking`, `payment`, `cancellation` et `profile_update` détectées depuis une transcription partielle ou ambiguë nécessitent une confirmation explicite via `clarification_state`.

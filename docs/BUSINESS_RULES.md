# Innoica Agent Studio — Règles Métier & Logique Commerciale

**Version :** 2.1  
**Devise :** XAF / FCFA  
**Fuseau horaire :** `Africa/Douala` (UTC+1, sans passage à l'heure d'été)  

---

## 1. Plans Officiels au Lancement (Source de Vérité Centralisée)

Définis en base PostgreSQL (`public.plans` + `public.app_commercial_settings`) et typés dans `packages/shared/src/constants/index.ts` (`PLAN_CATALOG`) :

| Règle / Paramètre | `free` | `starter` |
|---|---|---|
| **Prix mensuel** | 0 FCFA | **5 000 FCFA / mois** |
| **Prix annuel** | 0 FCFA | **54 000 FCFA / an** (`60 000 FCFA` sans remise, `-10%`, économie `6 000 FCFA`) |
| **Max agents (`max_agents`)** | 1 | 2 |
| **Max numéros WhatsApp (`max_connections`)** | 1 | 2 |
| **Max nouvelles conversations / jour** | **5** | `NULL` (Illimité plateforme) |
| **Max réponses bot / conversation / jour** | **10** | `NULL` (Illimité plateforme) |
| **Rétention historique** | 7 jours | `NULL` (Étendue) |
| **Docs de connaissances (`max_knowledge_docs`)** | 3 | 25 |
| **Types de connaissances autorisés** | `['faq', 'txt']` | `['faq', 'txt', 'pdf', 'url']` |
| **Signature publicitaire (`has_watermark`)** | `true` (ajoutée côté serveur) | `false` (aucune signature) |
| **Compréhension vocale (`voice_message_understanding`)** | `false` (aucun téléchargement audio ni transcription, réponse texte FR/EN) | `true` (incluse sans supplément sur tous les plans payants actifs) |

> Toute notion de plan `pro`, `enterprise`, `business` ou de système `skills` / `marketplace` est désactivée (`is_active = false` pour les anciens plans en base) et exclue de l'interface client.

---

## 5. Règles Commerciales & Techniques de Compréhension Vocale

1. **Droit structuré côté serveur (`voice_message_understanding`) :** vérifié via `resolve_voice_entitlement(workspace_id)` et `resolveVoiceCapabilities(...)` avant tout téléchargement de média audio ou appel au Speech Worker.
2. **Comportement strict Plan Free :** lorsqu'un contact envoie une note vocale WhatsApp à un agent sur plan Free :
   - Le média audio n'est **jamais téléchargé**, jamais transmis à Whisper et jamais envoyé au modèle IA.
   - Une réponse texte explicative FR/EN (`VOICE_FREE_PLAN_MESSAGES`) est envoyée en respectant les quotas journaliers existants, le verrou `human_takeover` et le watermark Free.
3. **Plans payants actifs (Starter et tout plan payant actif) :**
   - Compréhension native en français et en anglais avec détection automatique de la langue, transcription locale gratuite (`faster-whisper` CTranslate2 INT8 sur CPU via `services/speech-worker`), et zéro API payante ni fallback payant.
   - Les réponses s'appuient sur la séparation interne `sufficient` / `partial` / `insufficient` et sur un état `clarification_state` multi-tour (vocal ↔ texte) qui évite de reposer les faits validés et bloque toute exécution automatique d'action sensible (`order`, `booking`, `payment`, `cancellation`, `profile_update`) sans confirmation explicite.

---

## 2. Système de Quotas Free (Contrôle Côté Serveur)

1. **Définition d'une conversation :** Un fil unique `(agent_id, contact_phone)` lié à `conversations.id`. Plusieurs messages d'un même contact dans la même journée n'ouvrent jamais un second crédit de nouvelle conversation.
2. **Quota de 5 nouvelles conversations / jour (Free) :**
   - Comptabilisé dans `daily_conversation_claims` par `(workspace_id, period_date)` où `period_date = current_douala_date()`.
   - Une conversation créée un jour antérieur (`created_at` antérieur à `period_date` en `Africa/Douala`) qui reprend le lendemain **ne consomme pas** de crédit de nouvelle conversation.
3. **Quota de 10 réponses bot / conversation / jour (Free) :**
   - Comptabilisé dans `quota_reply_reservations` avec statuts `reserved` et `confirmed`.
   - Les messages entrants du client, messages humains ou erreurs techniques ne sont pas facturés contre le quota.
4. **Atomicité, Concurrence & Idempotence :**
   - `reserve_ai_reply_quota` acquiert un verrou transactionnel `pg_advisory_xact_lock(hashtext('quota:' || workspace_id || ':' || period_date))`.
   - Toute relance réseau avec la même `p_idempotency_key` renvoie `idempotent = true` sans décrémenter une deuxième fois.
   - Si l'appel LLM échoue ou est annulé (Human Takeover), `release_ai_reply_quota` passe le statut à `released` et libère immédiatement le quota.
   - Un contact WhatsApp ne reçoit **jamais** de message interne destiné à l'administrateur du workspace lorsque le quota Free est atteint.

---

## 3. Signature Publicitaire Automatique (Plan Free Uniquement)

- Gérée exclusivement côté serveur dans `services/ai-runtime` et `/api/agents/[id]` (mode test) via `applyPlanWatermark`.
- Utilise le domaine configuré dans `app_commercial_settings.official_domain` (`https://agents.innoica.com` par défaut) et les modèles FR/EN administrables.
- Fonction **idempotente** : ne duplique jamais la signature si elle est déjà présente.
- Strictement désactivée (`hasWatermark = false`) dès que le workspace possède un abonnement `starter` actif.

---

## 4. Règles Agent, WhatsApp & Human Takeover

1. **1 Numéro = 1 Agent :** Un numéro WhatsApp E.164 ne peut être actif simultanément que sur un seul agent.
2. **Pairing Code Exclusif :** `requestPairingCode()` uniquement, limitation anti-spam par fenêtre glissante.
3. **Human Takeover :** Trois modes (`ai_active`, `human_takeover`, `paused`). L'envoi d'un message manuel depuis `/conversations` force le passage en `human_takeover`.
4. **Activation d'Agent :** Requiert un prompt système non vide, un credential BYOK valide et un environnement prêt.
5. **Abonnement & Validation Super Admin :** Un workspace peut soumettre une déclaration de paiement (`monthly` 5 000 FCFA ou `yearly` 54 000 FCFA) sur `/subscription` ; seul un utilisateur avec `profiles.is_super_admin = true` peut approuver/rejeter la déclaration ou ajuster manuellement un plan ou les paramètres commerciaux dans `/admin`.

# Innoica Agent Studio — Plan de Test & Qualification

**Version :** 2.1  
**Statut :** Plan Actif de Qualification  

---

## 1. Niveaux de Vérification

| Niveau | Outils | Périmètre |
|---|---|---|
| **Contrôle Statique & Compilation** | `tsc --noEmit`, `next build` | Cohérence des types sur `@innoica/shared`, `apps/web`, workers et routes API/SSG. |
| **Tests Unitaires & Sécurité** | Vitest v2.1.9 + `unittest` Python (`py -3.14`) | Schémas Zod v2.1, tarifs Free/Starter, watermark non dupliqué, PDF `%PDF-` + 10 Mo, SSRF + redirections, chiffrement AES-256-GCM, chunking, i18n FR/EN, droits vocaux (`voice_message_understanding`), décodage OGG/Opus PyAV, détection silence & clarifications multi-tour. |
| **Intégration Workers (Mocked Harness)** | Vitest + Fastify `inject()` | Pairing Code only (zéro QR), Double Garde Human Takeover AI Runtime, endpoints `/api/ingest/*` avec SSRF bloqué. |
| **Intégration SQL Transactionnelle Live** | PostgreSQL (`supabase:execute_sql`) | `get_workspace_quota_snapshot`, plafond `5` nouvelles conversations / `10` réponses / conv, reprise conversation J-2 sans consommer de quota, idempotence et `release_ai_reply_quota`. |
| **Vérification Browser E2E Réelle** | Playwright Chromium | Rendu Desktop `1440x900` & Mobile `390x844`, FR & EN, Landing Page, Inscription, Dashboard `100dvh`, WhatsApp Pairing Code, Knowledge gating, Subscription, Inbox & `AutoGrowTextarea`. |

---

## 2. Scénarios Critiques Couverts

1. **Offres & Tarifs :** Uniquement `free` (0 FCFA) et `starter` (5 000 FCFA/mois, 54 000 FCFA/an, `-10%`, 60 000 FCFA barré, économie 6 000 FCFA) ; aucune 3e offre ni Skills/Marketplace.
2. **Quotas Free (`Africa/Douala`) :**
   - 5 premières nouvelles conversations du jour acceptées ; 6e refusée côté SQL (`daily_new_conversations_quota_reached`).
   - Reprise d'une conversation d'un jour précédent acceptée sans consommer de slot.
   - 10 réponses autorisées par conversation et par jour ; 11e refusée (`daily_conversation_replies_quota_reached`).
   - Rejeu idempotent (`p_idempotency_key`) sans double comptage ; libération (`release_ai_reply_quota`) sur erreur/annulation restaurant immédiatement le slot.
3. **Watermark Free :** Ajouté côté serveur sur Free sans duplication ; absent sur Starter.
4. **Sécurité :** Refus PDF sans signature `%PDF-` ou > 10 Mo, blocage SSRF `127.0.0.1` / `169.254.169.254` y compris après redirection HTTP 302, nettoyage octets nuls et balises XML dans les connaissances, RLS actif sur 25 tables, validation binaire magic-bytes audio.
5. **Compréhension Vocale WhatsApp (Free vs Starter) :**
   - Compte Free (`voice_message_understanding = false`) : zéro téléchargement média, zéro appel Whisper/LLM, réponse texte FR/EN respectant quotas et watermark Free.
   - Plans payants actifs (`voice_message_understanding = true`) : détection FR/EN, décodage OGG/Opus en mémoire, gestion explicite `sufficient` / `partial` / `insufficient` (`no_speech`, `unsupported`, `processing_error`), fusion multi-tour `clarification_state`, confirmation avant actions sensibles (`order`/`booking`/`payment`/`cancellation`/`profile_update`), zéro API payante ni fallback payant.
6. **Ergonomie & UX :** Absence de défilement global dans le dashboard `100dvh`, absence de débordement horizontal Desktop/Mobile, croissance automatique mesurée de `AutoGrowTextarea`.

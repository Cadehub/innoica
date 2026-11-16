# Innoica Agent Studio — Rapport de Test & Qualification

**Version :** 2.2 (Compréhension Vocale WhatsApp)  
**Date d'exécution :** 15 Novembre 2026  
**Environnement observé :** Node.js, pnpm workspaces, Vitest v2.1.9, Next.js v15.5.29, Python `3.14.0` (`faster-whisper 1.2.1`, `ctranslate2 4.8.1`, `av 15.1.0`, `onnxruntime 1.27.0`), PostgreSQL Supabase (`qsyiatlvkyzknawfgpja`), Chromium headless  

---

## 1. Résumé Exécutif des Exécutions Réelles

| Vérification | Commande / Outil | Résultat Observé |
|---|---|---|
| **TypeScript `@innoica/shared` & Workers** | `pnpm --filter @innoica/shared exec tsc --noEmit`, `innoica-whatsapp-worker`, `innoica-ai-runtime` | **PASS (exit 0)** |
| **TypeScript `apps/web`** | `pnpm --filter innoica-web exec tsc --noEmit` | **PASS (exit 0)** |
| **Suite Vitest Complète** | `pnpm vitest run` | **PASS : 11/11 fichiers, 66/66 tests réussis (0 échec, 0 skip)** |
| **Suite Python Speech Worker** | `py -3.14 -m unittest discover -s "services/speech-worker/tests" -p "test_*.py" -v` | **PASS : 7/7 tests réussis (`0.270s`, encodage/décodage OGG/Opus réel PyAV + modèle injecté FastAPI TestClient)** |
| **Build Production Complet** | `pnpm -r run build` | **PASS : workers + 47 pages SSG/statiques + API routes `apps/web` compilées (exit 0)** |
| **Audit Matériel & Santé Services** | `GET /health` (`4001`, `4002`, `4004`, `3000`) & `/api/hardware-audit` | **PASS : 4 CPU logiques, 15.85 Go RAM, CUDA=0, `paidApiFallback=false`, `modelLoaded=false (local_model_weights_missing)` hors ligne** |
| **Droits Vocaux & Quotas PostgreSQL Live** | `supabase:execute_sql` (`Workspace Ethan` Starter & `Workspace de Test User` Free) | **PASS : `resolve_voice_entitlement` & `get_workspace_quota_snapshot` renvoient `true` sur Starter et `false` sur Free** |
| **Parcours Browser E2E (`http://localhost:3000`)** | Playwright Chromium (`1440x900` & `390x844`) | **PASS : 0 erreur console, 0 HTTP 4xx/5xx, landing FR/EN, `/subscription` et `/conversations` vérifiés** |

---

## 2. Détail des 11 Fichiers Vitest (66 / 66 Tests) & 7 Tests Python

1. `tests/voice-understanding.test.ts` — 5 tests PASS (`voice_message_understanding` Free `false` vs Starter/actifs `true`, messages officiels Free FR/EN + watermark, extraction audio `audioMessage` + magic-bytes + taille/durée, langue FR/EN & 3 états de compréhension, masquage `<innoica_voice_state>` + fusion clarifications + garde-fou actions sensibles).
2. `services/speech-worker/tests/test_speech_worker.py` — 7 tests `unittest` PASS (`0.270s`) (synthèse/décodage réel OGG/Opus PyAV 16 kHz mono, détection silence `no_speech`, rejet corruptions/MIME falsifiés/surpoids, catégories `high`/`partial`/`low`/`no_speech`, auth `x-worker-secret` `/api/transcribe`, absence de fallback payant si modèle local manquant).
3. `tests/e2e-workflow.test.ts` — 13 tests PASS (invariants E2E, plans Free/Starter, watermark sans duplication, date `Africa/Douala`, assainissement connaissances, RAG & Human Takeover).
2. `tests/studio-v21-verification.test.ts` — 5 tests PASS (calcul `5 000 FCFA/mois` / `54 000 FCFA/an` `-10%`, validation schémas paiement/admin, PDF `%PDF-` + 10 Mo, SSRF redirection 302 vers `169.254.169.254`, watermark).
3. `packages/shared/src/__tests__/schemas.test.ts` — 7 tests PASS.
4. `packages/shared/src/__tests__/aes.test.ts` — 4 tests PASS.
5. `packages/shared/src/__tests__/ssrf.test.ts` — 7 tests PASS.
6. `services/ai-runtime/src/__tests__/orchestrator.test.ts` — 6 tests PASS.
7. `services/whatsapp-worker/src/__tests__/worker.test.ts` — 5 tests PASS.
8. `services/ingestion-worker/src/__tests__/chunker.test.ts` — 3 tests PASS.
9. `services/ingestion-worker/src/__tests__/ingestion.test.ts` — 4 tests PASS.
10. `apps/web/src/__tests__/ui.test.ts` — 7 tests PASS (i18n FR/EN, zéro QR code, devise FCFA).

---

## 3. Résultats Clés de la Vérification Browser E2E

- **Landing `/fr` & `/en` :** `scrollWidth = 1424.67px <= 1440px` (desktop), `374.67px <= 390px` (mobile), simulateur WhatsApp interactif, bascule `5 000 FCFA/mois` / `54 000 FCFA/an (-10%)`, accordéon FAQ fonctionnel, 0 occurrence de Pro/Business/Enterprise/Skills/Marketplace/QR.
- **Dashboard & Shell Authentifié :** `scrollHeight = 900px === innerHeight (900px)` (aucun défilement global externe sur desktop), tiroir mobile `390px` fonctionnel (`scrollWidth = 390px`), compteurs Free `0 / 5` affichés.
- **`AutoGrowTextarea` (`/fr/agents/new`) :** Passage automatique mesuré de `42px` (1 ligne) à `84px` (3 lignes avec `Shift+Enter`).
- **WhatsApp (`/fr/whatsapp`), Knowledge (`/fr/knowledge`), Subscription (`/fr/subscription`), Inbox (`/fr/conversations`) :** Appairage par Pairing Code exclusif, PDF/URL restreints sur Free avec incitation Starter, architecture 3 colonnes WhatsApp Web vérifiée sans erreur console ni erreur HTTP serveur.

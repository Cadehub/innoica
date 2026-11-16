# Innoica Agent Studio — Journal d'Avancement (PROGRESS)

**Version :** 2.1  
**Dernière mise à jour :** 14 Novembre 2026  

---

## 1. Synthèse des Livrables v2.1

| Chantier | Statut | Preuves & Artefacts |
|---|---|---|
| **Grille Commerciale Simplifiée (Free & Starter Uniquement)** | Terminé | `PLAN_CATALOG` (`packages/shared`), table `plans` live (`free` 0 FCFA, `starter` 5 000 FCFA/mois et 54 000 FCFA/an `-10%`), plans `pro`/`enterprise` désactivés (`is_active=false`). |
| **Quotas Free Serveur & Watermark** | Terminé & Vérifié Live | `reserve_ai_reply_quota`, `confirm_ai_reply_quota`, `release_ai_reply_quota`, `get_workspace_quota_snapshot` testés en transaction SQL live + `applyPlanWatermark` idempotent dans `services/ai-runtime` & `/api/agents/[id]`. |
| **Sécurité & Isolation Multi-Tenant** | Terminé | RLS actif sur 24 tables Supabase, `WORKER_INTERNAL_SECRET`, anti-SSRF strict redirections incluses (`safeFetchPublicUrl`), PDF `%PDF-` + 10 Mo, assainissement balises XML + `\u0000`, 0 QR code. |
| **Refonte UX/UI Pleine Hauteur `100dvh` & Inbox WhatsApp Web** | Terminé & Vérifié Browser | Shell `h-[100dvh]`, Inbox 3 colonnes (`conversations/inbox-client.tsx`), `AutoGrowTextarea` vérifié à 42px -> 84px, Landing Page FR/EN animée 2D+3D (`prefers-reduced-motion`). |
| **Workflows Admin & Paiements Cameroun** | Terminé | `/subscription` (Orange Money, MTN MoMo, Virement) + `/admin` (approbation/rejet paiements, gestion plans, domaines watermark, workspaces, audit logs). |
| **Qualification Automatisée & E2E** | Terminé | `tsc --noEmit` (0 erreur), `vitest` (11 fichiers / 66 tests PASS), `unittest` Speech Worker (7/7 tests PASS), `pnpm -r run build` PASS, E2E Chromium Desktop/Mobile FR/EN (0 erreur console / HTTP 4xx-5xx). |
| **Compréhension Vocale WhatsApp (FR & EN)** | Terminé (poids Whisper à télécharger en prod en ligne) | `services/speech-worker` (`faster-whisper 1.2.1` INT8 + `av 15.1.0`), contrôle serveur `resolve_voice_entitlement`, gate zéro-téléchargement Free, pipeline Baileys + clarifications AI Runtime, UI Inbox/Subscription/Admin & Docker Compose. |
| **Documentation Complète (`/docs`)** | Terminé | Documents mis à jour avec architecture vocale, audit matériel réel et limitations transparentes. |

# Innoica Agent Studio — Décisions d'Architecture (ADR)

**Version :** 2.1  
**Statut :** Décisions Actives  

---

## ADR-001 — Simplification Commerciale à 2 Offres (Free & Starter)
- **Décision :** Remplacer les anciennes grilles Starter/Pro/Enterprise par exactement 2 plans actifs : `free` (0 FCFA) et `starter` (5 000 FCFA/mois, 54 000 FCFA/an soit -10 % sur 60 000 FCFA).
- **Raison :** Clarté commerciale au lancement au Cameroun, validation rapide par Mobile Money et suppression de toute complexité superflue (aucune 3e offre, aucun module Skills/Marketplace).

## ADR-002 — Quotas Atomiques Côté PostgreSQL (`Africa/Douala`)
- **Décision :** Gérer les quotas Free (`5` nouvelles conversations/jour, `10` réponses IA/conversation/jour) directement via des fonctions SQL transactionnelles (`reserve_ai_reply_quota`, `confirm_ai_reply_quota`, `release_ai_reply_quota`) utilisant `pg_advisory_xact_lock`, un calendrier `Africa/Douala` et des clés d'idempotence.
- **Raison :** Empêcher tout contournement par redémarrage worker, reconnexion WhatsApp, rafraîchissement navigateur ou rafale concurrente.

## ADR-003 — Watermark Publicitaire Imposé Côté Serveur sur Free
- **Décision :** Injecter la signature publicitaire INNOICA exclusivement côté serveur (`applyPlanWatermark` appelé dans `services/ai-runtime` et `/api/agents/[id]`) à partir du domaine configuré dans `app_commercial_settings`, sans l'ajouter sur Starter.

## ADR-004 — Appairage WhatsApp Baileys par Pairing Code Exclusif
- **Décision :** Interdiction absolue du QR code (`printQRInTerminal: false`), génération de code à 8 caractères via `requestPairingCode` uniquement, sessions persistées et restaurées automatiquement côté `services/whatsapp-worker`.

## ADR-005 — Refonte Pleine Hauteur `100dvh` & Inbox WhatsApp Web
- **Décision :** Adopter une coque dashboard pleine hauteur avec défilements indépendants par panneau, champs `AutoGrowTextarea` et landing page claire futuriste 2D+3D animée compatible `prefers-reduced-motion`.

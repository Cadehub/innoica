# Innoica Agent Studio — Procédures Opérationnelles

**Version :** 2.1  
**Statut :** Procédures Active & Super Admin  

---

## 1. Supervision des Services Locaux / Conteneurs

| Service | Port par défaut | Endpoint Santé | Rôle |
|---|---:|---|---|
| `innoica-web` | `3000` | `/` | Interface SaaS Next.js + Routes API |
| `innoica-whatsapp-worker` | `4001` | `/health` | Sessions Baileys, Pairing Code, réception/envoi WhatsApp |
| `innoica-ai-runtime` | `4002` | `/health` | Quotas SQL, BYOK LLM, Double Garde Human Takeover, Watermark |
| `innoica-ingestion-worker` | `4003` | `/health` | Extraction PDF/TXT/URL anti-SSRF et chunking |

---

## 2. Gestion Quotidienne Super Admin (`/admin`)

1. **Validation des paiements manuels (Orange Money / MTN MoMo / Virement) :**
   - Vérifier la référence transactionnelle dans `/admin` -> onglet Paiements.
   - Approuver ou rejeter la déclaration ; l'approbation active automatiquement l'abonnement `starter` (`monthly` 30 jours ou `yearly` 365 jours), supprime la signature publicitaire et enregistre une ligne dans `audit_logs`.
2. **Administration des plans & paramètres commerciaux :**
   - Mettre à jour `official_domain`, modèles de watermark FR/EN, limites de `plans` (`free` / `starter`) ou statut d'un workspace (`active` / `suspended`) directement via le panneau `/admin` sans redéploiement.

---

## 3. Sauvegarde & Préservation Héritée

- Base de données Supabase (`qsyiatlvkyzknawfgpja`) : sauvegardes gérées au niveau plateforme Supabase et tables `legacy_*` préservées en lecture seule.
- Archive du dépôt historique : `C:\Users\UltraBook 3.1\Desktop\innoica-backup-legacy-20261114.zip`.
- Sessions WhatsApp : persistées dans `services/whatsapp-worker/sessions/` (local) ou volume monté `/app/sessions` (Docker) avec restauration automatique au redémarrage du worker.

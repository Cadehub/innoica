# INNOICA WhatsApp Agents — Opérations & Maintenance

**Version :** 2.0  
**Statut :** Procédures Opérationnelles

---

## 1. Inventaire et Sauvegarde de l'Ancien Projet (Effectué)

Conformément à la directive non négociable de Phase 0 :
- **Projet hérité inventorié :** `C:\Users\UltraBook 3.1\Desktop\innoica` (ancien Agent Studio avec architecture expérimentale QR code).
- **Éléments sauvegardés :** Code source, configurations, spécifications initiales, migrations SQL.
- **Archive créée et vérifiée :** `C:\Users\UltraBook 3.1\Desktop\innoica-backup-legacy-20261114.zip` (499 Ko, excluant `node_modules` et `.next`).
- **Protection des ressources partagées :**
  - Aucun projet tiers touché (dossiers Desktop intacts : `CB-Services`, `cb-services-commerce`, `RestoGesto`, etc.).
  - Base Supabase `cb-services` (`gaylhhpofahseviobngs`) formellement préservée.
  - Données utilisateurs de base préservées dans `auth.users` (`biteckdebongethancade@gmail.com`).

---

## 2. Déploiement VPS Contabo (Docker Compose)

### Services Déployés :
1. `innoica-web` : Next.js 15 App Router en mode standalone Node.js.
2. `innoica-whatsapp-worker` : Service Baileys en conteneur persistant (redémarrage `unless-stopped`).
3. `innoica-ai-runtime` : Moteur d'exécution des prompts et BYOK.
4. `innoica-ingestion-worker` : Service d'ingestion documentaire et scraping anti-SSRF.
5. `innoica-queue` : Instance Redis 7 Alpine dédiée avec persistance AOF.
6. `innoica-reverse-proxy` : Caddy ou Nginx avec certificats TLS Let's Encrypt automatiques.

### Commandes Opérationnelles Usuelles :
```bash
# Vérification des conteneurs
docker compose -f docker-compose.prod.yml ps

# Consultation des logs structurés (sans fuite de secrets)
docker compose -f docker-compose.prod.yml logs -f innoica-whatsapp-worker
docker compose -f docker-compose.prod.yml logs -f innoica-ai-runtime

# Redémarrage gracieux d'un worker
docker compose -f docker-compose.prod.yml restart innoica-whatsapp-worker
```

---

## 3. Sauvegardes & Restauration

- **Base de données Supabase :** Backups automatisés quotidiens PostgreSQL.
- **Sessions WhatsApp :** Volume persistant chiffré `/var/data/innoica/sessions/`.
- **Restauration :** En cas d'incident sur le VPS, redéploiement via le docker-compose et rattachement des volumes existants.

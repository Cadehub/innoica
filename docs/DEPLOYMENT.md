# INNOICA WhatsApp Agents — Guide de Déploiement (VPS Contabo)

**Version :** 2.0  
**Statut :** Guide Opérationnel de Déploiement

---

## 1. Prérequis sur le VPS Contabo

- **Système :** Ubuntu 22.04 LTS ou 24.04 LTS (ou Debian équivalent).
- **Docker :** Version 24+ avec le plugin `docker compose` (v2).
- **Ressources recommandées :**
  - Minimum 4 cœurs vCPU.
  - Minimum 8 Go de RAM.
  - 50 Go d'espace disque disponible.
- **Ports ouverts :**
  - `80/tcp` (HTTP pour le challenge ACME Let's Encrypt).
  - `443/tcp` (HTTPS pour le dashboard et l'API).

---

## 2. Variables d'Environnement de Production

Créer un fichier `.env.production` sur le VPS :

```env
# Node Environment
NODE_ENV=production

# URLs Publiques
NEXT_PUBLIC_APP_URL=https://agents.innoica.com
NEXT_PUBLIC_APP_NAME="INNOICA WhatsApp Agents"
NEXT_PUBLIC_APP_TAGLINE="Turn Complexity Into Simplicity"

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://qsyiatlvkyzknawfgpja.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Chiffrement Maître AES-256-GCM (64 caractères hexadécimaux = 32 octets)
ENCRYPTION_MASTER_KEY=4f9c2d1b8e7a3f0c6d5e4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e

# Redis & BullMQ
REDIS_HOST=innoica-queue
REDIS_PORT=6379
REDIS_PASSWORD=une_cle_redis_securisee_ici

# Workers Configuration
WHATSAPP_WORKER_PORT=4001
AI_RUNTIME_PORT=4002
INGESTION_WORKER_PORT=4003
```

---

## 3. Déploiement avec Docker Compose

```bash
# 1. Cloner le dépôt ou transférer les fichiers
git clone <url-du-depot> innoica-wa-agent
cd innoica-wa-agent

# 2. Configurer les variables d'environnement
cp .env.example .env.production
nano .env.production

# 3. Construire et démarrer les conteneurs
docker compose -f docker-compose.prod.yml up -d --build

# 4. Vérifier l'état d'exécution
docker compose -f docker-compose.prod.yml ps
```

# Innoica Agent Studio — Guide de Déploiement Production (Vercel & VPS / Docker)

**Version :** 2.2  
**Architecture :** 
- **Frontend & App Web :** Vercel (Next.js 15, SSR, Edge Middleware, Static Generation)
- **Base de Données & Auth :** Supabase (PostgreSQL 15+, pgvector, Row Level Security, Realtime)
- **Workers d'Arrière-Plan (Stateful) :** VPS / Docker Compose / Railway (Baileys WhatsApp, AI Runtime, Ingestion anti-SSRF, Faster-Whisper CPU INT8)

---

## 1. Déploiement Frontend sur Vercel

### A. Configuration du Projet Vercel (Monorepo)
1. Rendez-vous sur le tableau de bord Vercel ([vercel.com](https://vercel.com)) et cliquez sur **Add New... > Project** (ou ouvrez les **Settings > General** de votre projet existant).
2. Importez le dépôt GitHub : `https://github.com/Cadehub/innoica.git`.
3. **Root Directory (CRITIQUE)** : 
   - Cliquez sur **Edit** à côté de **Root Directory**.
   - Sélectionnez ou tapez : `apps/web`
   - Cliquez sur **Save**.
   *(Comme il s'agit d'un monorepo pnpm, Vercel a besoin de savoir que l'application Next.js réside dans `apps/web`. Vercel détectera alors automatiquement Next.js 15 et le fichier `pnpm-lock.yaml` à la racine).*
4. **Framework Preset** : `Next.js` (détecté automatiquement).
5. **Build & Development Settings** : Laissez les valeurs par défaut de Vercel.

### B. Variables d'Environnement Vercel (Environment Variables)
Dans les paramètres du projet Vercel (*Settings > Environment Variables*), ajoutez les variables suivantes :

```env
# URL publique du SaaS
NEXT_PUBLIC_APP_URL=https://votre-projet.vercel.app

# Connexion Supabase (Obligatoire)
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...

# Sécurité & Chiffrement (Obligatoire)
ENCRYPTION_MASTER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
WORKER_INTERNAL_SECRET=votre-cle-secrete-interne-tres-longue-min-32-chars

# URLs des Workers distants (Exposés sur votre VPS ou hébergeur de conteneurs)
WHATSAPP_WORKER_URL=https://wa.votre-domaine.com
AI_RUNTIME_URL=https://ai.votre-domaine.com
INGESTION_WORKER_URL=https://ingestion.votre-domaine.com
SPEECH_WORKER_URL=https://speech.votre-domaine.com
```

---

## 2. Déploiement des Workers d'Arrière-Plan (VPS / Docker Compose)

Les workers nécessitent des connexions persistantes (WebSocket WhatsApp Baileys, sessions locales, modèle vocal Whisper en mémoire vive). Ils doivent tourner sur une instance continue (VPS type Contabo, Hetzner, DigitalOcean ou Railway).

### Prérequis VPS
- Ubuntu 22.04 LTS ou 24.04 LTS avec Docker Engine 24+ et `docker compose` v2.
- Reverse Proxy TLS (Caddy ou Nginx) pour exposer les endpoints HTTPS vers Vercel.

### Commandes de Déploiement VPS
```bash
git clone https://github.com/Cadehub/innoica.git
cd innoica
cp .env.production.example .env.production
# Renseigner les variables d'environnement dans .env.production
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

---

## 3. Commandes de Démarrage Manuel (Local ou Serveur Dédié)

> Pour le démarrage manuel des services en mode production :
> - Compilation générale du monorepo : `pnpm -r run build`
> - Lancement de l'application Web Next.js (port 3000) : `pnpm start` (ou `pnpm --filter innoica-web start`)
> - Lancement du Worker WhatsApp Baileys (port 4001) : `pnpm start:wa`
> - Lancement de l'Orchestrateur IA (port 4002) : `pnpm start:ai`
> - Lancement du Worker Vocal Speech (port 4004) : `pnpm start:speech`
> - Lancement du Worker d'Ingestion (port 4003) : `pnpm start:ingestion`
> - Lancement de la suite de tests complète : `pnpm test` (68/68 tests validés)

# Configuration Déploiement Vercel (Monorepo)

Pour déployer l'application web sur Vercel avec succès :

### 1. Paramètre Indispensable : Root Directory
Puisque le projet est un monorepo pnpm (`apps/web`, `services/*`, `packages/*`), l'application Next.js 15 se situe dans **`apps/web`**.

Dans le projet Vercel :
1. Accédez à **Settings** > **General**.
2. Dans la section **Root Directory**, cliquez sur **Edit**.
3. Renseignez : `apps/web`.
4. Cliquez sur **Save** (laissez cochée l'option permettant d'accéder aux fichiers du monorepo).

### 2. Détection Automatique par Vercel
Une fois le **Root Directory** configuré sur `apps/web` :
- Vercel détecte automatiquement **Next.js 15.1.7** dans `apps/web/package.json`.
- Vercel détecte automatiquement le workspace pnpm (`../../pnpm-lock.yaml`) et installe les dépendances partagées (`@innoica/shared`, `@innoica/database`).
- Vercel compile automatiquement le projet via `next build`.

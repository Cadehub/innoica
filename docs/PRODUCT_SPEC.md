# Innoica Agent Studio — Spécification Produit

**Marque :** INNOICA  
**Produit :** Innoica Agent Studio  
**Slogan :** Turn Complexity Into Simplicity  
**Version :** 2.1  
**Marché cible initial :** Cameroun (étendu à l'international)  
**Devise :** XAF / FCFA  
**Fuseau horaire de référence :** `Africa/Douala`  
**Langues :** Français (défaut) et Anglais (`fr`, `en`)  

---

## 1. Vision & Positionnement

**Innoica Agent Studio** est une plateforme SaaS permettant aux entreprises (prioritaire au lancement : commerces, restaurants, prestataires, cabinets, PME) et aux particuliers de créer, configurer, connecter et superviser des agents IA autonomes sur WhatsApp.

### Règles Fondatrices Immutables
1. **Appairage Baileys par Pairing Code uniquement** (`XXXX-XXXX`) : aucun QR code n'est généré, affiché ou proposé en secours dans toute l'application.
2. **Modèle BYOK (Bring Your Own Key)** : le client connecte sa propre clé API (Google Gemini, Groq, OpenRouter, OpenAI) chiffrée en AES-256-GCM.
3. **Deux offres commerciales uniquement au lancement** : **Free** (0 FCFA) et **Starter** (5 000 FCFA/mois ou 54 000 FCFA/an). Aucune troisième offre (Pro, Business, Enterprise) ni système de Skills/Marketplace.
4. **Contrôle Humain prioritaire (Human Takeover)** : toute intervention manuelle bascule le fil en mode `human_takeover` et empêche l'agent IA de répondre de manière concurrente.

---

## 2. Catalogue d'Offres Officielles (Free & Starter)

| Caractéristique | Free | Starter |
|---|---|---|
| **Tarif mensuel** | **0 FCFA** | **5 000 FCFA / mois** |
| **Tarif annuel** | 0 FCFA | **54 000 FCFA / an** (`-10%` sur 60 000 FCFA, économie de **6 000 FCFA**) |
| **Agents WhatsApp max** | 1 agent | 2 agents |
| **Numéros WhatsApp max** | 1 numéro (Pairing Code) | 2 numéros (Pairing Code) |
| **Nouvelles conversations / jour** | **5 / jour** (`Africa/Douala`) | **Illimité côté plateforme** |
| **Réponses bot / conversation / jour** | **10 / conversation / jour** (`Africa/Douala`) | **Illimité côté plateforme** |
| **Rétention historique** | 7 jours | Étendue (illimitée côté plateforme) |
| **Connaissances autorisées** | FAQ & TXT (max 3 documents) | FAQ, TXT, **PDF** & **URL publique** (max 25 documents) |
| **Signature publicitaire INNOICA** | **Obligatoire côté serveur** sur chaque réponse IA | **Supprimée** |
| **Compréhension des messages vocaux (FR & EN)** | Non incluse (`voice_message_understanding = false`, réponse texte explicative) | **Incluse sans frais supplémentaires** (`voice_message_understanding = true`, détection FR/EN, transcription locale) |
| **Mémoire** | Historique récent (7 j) | Mémoire par conversation + mémoire durable par contact |
| **Supervision & Inbox** | Supervision de base | Inbox complète WhatsApp Web, Human Takeover, recherche, notes & mémoire |

---

## 3. Modèles d'Agents (Templates Préconfigurés)

Six modèles sont disponibles via un moteur d'exécution unique :
1. **Receptionist Agent** (`receptionist`) — Accueil, horaires, services, FAQ, transfert humain.
2. **Sales Agent** (`sales`) — Qualification commerciale, présentation d'offres, transmission de commandes.
3. **Support Agent** (`support`) — Assistance technique, diagnostic guidé, escalade.
4. **Booking Agent** (`booking`) — Collecte de demandes de rendez-vous sans inventer de disponibilités temps réel.
5. **Restaurant Agent** (`restaurant`) — Menu, commandes, réservations de table.
6. **Custom Agent** (`custom`) — Instructions 100 % libres.

---

## 4. Parcours Utilisateur Clés

1. **Landing Page (`/fr`, `/en`)** : Simulateur WhatsApp interactif multi-scénarios, présentation 3 étapes, comparaison transparente Free vs Starter avec bascule mensuel/annuel, FAQ interactive.
2. **Authentification & Bootstrap Workspace (`/fr/register`, `/fr/login`, `/auth/callback`)** : Création automatique du profil, du workspace Free et de l'abonnement actif via le RPC `bootstrap_user_workspace`.
3. **Configuration Agents & BYOK (`/agents/new`, `/agents/[id]`, `/ai-credentials`)** : Validation temps réel de la clé API chez le fournisseur et test interactif de l'agent.
4. **Appairage WhatsApp (`/whatsapp`)** : Saisie du numéro E.164 (indicatif +237 Cameroun par défaut) et génération d'un code à 8 caractères via Baileys.
5. **Inbox WhatsApp Web (`/conversations`)** : Interface pleine hauteur `100dvh` en 3 colonnes (liste + recherche/filtres, fil de discussion + compositeur auto-extensible, panneau d'inspection contextuel rétractable).
6. **Abonnement & Paiement Cameroun (`/subscription`)** : Déclaration de paiement Orange Money, MTN MoMo ou virement avec validation Super Admin dans `/admin`.

# INNOICA WHATSAPP AGENTS
## Cahier des charges fonctionnel et technique — Version 2.0

**Éditeur :** INNOICA  
**Slogan :** Turn Complexity Into Simplicity  
**Produit :** INNOICA WhatsApp Agents  
**Version :** 2.0  
**Statut :** Spécification de référence pour la reconstruction  
**Zone principale :** Cameroun et marché international  
**Langues :** Français et anglais  
**Devise :** XAF / FCFA  
**Fuseau horaire :** Africa/Douala

---

# 1. Décisions fondatrices

Les décisions suivantes sont considérées comme validées et ne doivent pas être remises en question pendant la reconstruction sans nouvelle instruction explicite.

| Élément | Décision |
|---|---|
| Nouveau projet | Nouveau dépôt indépendant |
| Ancien projet | Suppression après inventaire et sauvegarde de sécurité |
| Produit | SaaS de création et gestion d'agents IA WhatsApp |
| Connecteur WhatsApp MVP | Baileys |
| Méthode d'appairage | Pairing Code uniquement |
| QR Code | Strictement interdit |
| Numéro WhatsApp | Saisie manuelle au format international |
| Attribution | Un numéro par agent |
| Hébergement Worker | VPS Contabo existant |
| Fournisseurs IA | BYOK — clé API personnelle du client |
| Mémoire | Conversation + mémoire durable par contact |
| Connaissances | FAQ, PDF, TXT et URL publique |
| Paiement | Abonnement mensuel et annuel |
| Interface | Français et anglais |
| Administration | Panel client + panel Super Admin INNOICA distinct |

**Règle absolue :** aucune fonctionnalité, documentation, interface, API ou logique de secours ne doit introduire un QR code. L'unique méthode d'association d'un compte WhatsApp est le Pairing Code.

# 2. Vision du produit

INNOICA WhatsApp Agents est une plateforme SaaS qui permet aux entreprises et aux particuliers de créer leurs propres agents IA spécialisés, de les connecter à leurs numéros WhatsApp et de leur confier automatiquement une partie de leurs conversations.

La plateforme ne doit pas être conçue comme un simple chatbot généraliste.

L'utilisateur doit pouvoir :
1. Créer un agent spécialisé.
2. Choisir un modèle de configuration.
3. Définir son identité, son rôle et ses instructions.
4. Ajouter ses informations et documents.
5. Configurer son fournisseur IA avec sa propre clé API.
6. Associer un numéro WhatsApp par Pairing Code.
7. Activer son agent.
8. Consulter les conversations.
9. Reprendre manuellement le contrôle des échanges.
10. Suspendre, modifier ou supprimer son agent.

## 2.1 Proposition de valeur
Permettre à une entreprise ou à un particulier de disposer d'un agent IA opérationnel sur WhatsApp, personnalisé selon son activité, sans avoir à développer son propre système technique.

## 2.2 Clients ciblés
Deux segments sont acceptés :
- Entreprises : commerces, restaurants, hôtels, prestataires de services, agences, établissements de formation et PME.
- Particuliers : indépendants, créateurs, consultants et personnes souhaitant automatiser des échanges.

La priorité commerciale initiale sera donnée aux entreprises.

# 3. Modèles d'agents

Les modèles sont des configurations préconstruites utilisant un moteur d'exécution commun. Ils ne doivent pas devenir des applications indépendantes.

## 3.1 Receptionist Agent (Priorité MVP)
- Accueillir les nouveaux contacts.
- Présenter l'entreprise.
- Répondre aux questions fréquentes.
- Présenter les horaires, services et tarifs.
- Orienter les clients.
- Transférer une conversation à un humain.

## 3.2 Sales Agent
- Présenter un catalogue de produits ou services.
- Conseiller les clients.
- Répondre aux questions commerciales.
- Collecter les demandes.
- Transmettre les intentions d'achat à l'équipe humaine.

## 3.3 Support Agent
- Répondre aux questions de support.
- Consulter la base de connaissances.
- Identifier les problèmes.
- Recueillir les informations nécessaires.
- Escalader les demandes complexes.

## 3.4 Booking Agent
- Collecter les demandes de rendez-vous.
- Recueillir les dates et préférences.
- Présenter les informations disponibles.
- Transmettre les demandes à une personne ou à un système connecté.
*Aucune disponibilité réelle ne doit être inventée en l'absence d'intégration à une source de disponibilité.*

## 3.5 Restaurant Agent
- Présenter le menu.
- Répondre aux questions sur les plats.
- Recueillir les commandes.
- Collecter les informations utiles.
- Transmettre les demandes au personnel.
*Aucun paiement en ligne ou système de caisse n'est prévu dans le MVP.*

## 3.6 Custom Agent
- Permettre à l'utilisateur de construire un agent avec des instructions personnalisées.

# 4. Gestion des agents

Chaque agent possède :
- Nom, description, modèle de départ.
- Identité, personnalité, instructions système.
- Langue principale.
- Connaissances rattachées.
- Configuration IA (fournisseur, modèle, clé).
- Connexion WhatsApp.
- Configuration de mémoire.
- État opérationnel (`draft`, `pending_connection`, `connected`, `active`, `paused`, `error`, `disconnected`).
- Historique d'activité.

Actions : Créer, modifier, dupliquer, tester, activer, suspendre, supprimer.
*Règle : Un agent ne doit jamais être déclaré actif si sa connexion WhatsApp ou sa configuration IA obligatoire est invalide.*

# 5. Connexion WhatsApp — Pairing Code uniquement

## 5.1 Principe
La connexion WhatsApp repose sur Baileys dans un service Node.js indépendant.
Saisie manuelle du numéro WhatsApp au format international (+237XXXXXXXXX). Normalisation et validation strictes avant génération.

## 5.2 Parcours utilisateur obligatoire
1. L'utilisateur ouvre la configuration WhatsApp de son agent.
2. Il saisit son numéro international.
3. Il confirme le numéro.
4. Le backend vérifie les conditions de génération.
5. Le Worker WhatsApp initialise une session isolée.
6. Le Worker demande un Pairing Code à Baileys (`requestPairingCode`).
7. Le code est transmis au dashboard par un canal sécurisé.
8. L'utilisateur ouvre WhatsApp sur son téléphone > Appareils connectés > Associer avec numéro de téléphone.
9. L'utilisateur saisit le code.
10. Le Worker détecte la connexion effective.
11. Le backend met à jour l'état.
12. Le dashboard affiche la confirmation uniquement après événement réel de connexion.

## 5.3 Règles techniques
- `requestPairingCode()` de Baileys côté Worker uniquement.
- Aucun code permanent, expiration et renouvellement contrôlés.
- Limitation des tentatives et protection anti-brute force / requêtes répétées.
- Isolation stricte des sessions par agent/workspace.
- Un numéro ne peut être attribué simultanément à plusieurs agents.
- Connexion révocable depuis le dashboard.

## 5.4 Interdictions absolues
- Aucun QR code, aucun bouton scan, aucune lib QR, aucun secours QR, aucun QR dans logs/outils.

## 5.5 Gestion des sessions & avertissement
- Isolation totale des sessions (une panne de session n'impacte pas les autres).
- Avertissement clair : Baileys n'est pas officiel Meta. Risques de déconnexion/limitation expliqués sans fausses promesses. Spam interdit.

# 6. Intelligence artificielle — BYOK
- Fournisseurs : OpenRouter, Groq, Google Gemini, OpenAI, et adaptateurs futurs.
- Clés API chiffrées côté serveur (clé maîtresse hors base de données).
- Pas de fallback payant silencieux. Erreurs de quota, d'authentification et de fournisseur distinctes.

# 7. Base de connaissances
- Sources : FAQ manuelles, PDF, TXT, URL web publiques.
- Extraction, nettoyage, chunking, indexation et recherche contextuelle.
- Sécurité : validation MIME et contenu, SSRF protection stricte (pas d'adresses privées/locales), timeouts.
- Données non fiables : les connaissances ne supplantent jamais les instructions système.

# 8. Mémoire
- Mémoire de conversation (court terme).
- Mémoire durable par contact (préférences, historique synthétique, besoins récurrents).
- Contrôle utilisateur : consultation, modification, suppression, désactivation. Aucun secret mémorisé.

# 9. Conversations et contrôle humain
- Inbox de gestion : liste, recherche, messages, identification contacts, notes internes.
- 3 modes de contrôle :
  1. **AI Active** : l'agent répond automatiquement.
  2. **Human Takeover** : un humain reprend le contrôle. Réponse IA bloquée.
  3. **Paused** : réponses automatiques suspendues.
- Double vérification du statut Human Takeover avant envoi effectif de la réponse IA.

# 10. Architecture technique
- Frontend : Next.js App Router, TypeScript strict, Tailwind CSS, shadcn/ui, Lucide, React Hook Form, Zod, next-intl, pnpm.
- Backend/Données : Supabase (Auth, Postgres, Storage, Realtime, RLS).
- Services persistants VPS Contabo :
  - `innoica-web`
  - `innoica-whatsapp-worker`
  - `innoica-ai-runtime`
  - `innoica-ingestion-worker`
  - `innoica-queue`
  - `innoica-reverse-proxy`
- Stack Worker : Node.js, TypeScript, Baileys, Docker, Redis, BullMQ.

# 11. Modèle de données & RLS
- Tables : profiles, workspaces, workspace_members, agents, agent_templates, whatsapp_connections, whatsapp_sessions, ai_providers, ai_credentials, agent_knowledge_sources, agent_knowledge_chunks, contacts, conversations, messages, contact_memories, conversation_memories, human_handoffs, execution_logs, usage_records, subscriptions, plans, audit_logs.
- Isolation stricte multi-workspace, RLS activé partout, chiffrement serveur des secrets (AES-256-GCM).

# 12. Rôles & Administration
- Rôles client : Owner, Admin, Member.
- Panel Super Admin INNOICA distinct avec bootstrap sécurisé (supervision, quotas, workspaces, utilisateurs, plans).

# 13. Abonnements
- Mensuel / Annuel. Gestion des quotas et limites contrôlées strictement côté serveur.

# 14. Dashboard Client & 15. Panel Super Admin
- UI claire, professionnelle (blanc, graphite, bleu électrique, violet).
- Uniquement des données réelles, zéro faux indicateur, zéro bouton décoratif.

# 16. Exclusions MVP
- Pas de visual workflow, pas de campagnes marketing / blast, pas d'appels vocaux, pas d'app mobile native, pas de passerelle de paiement tierce imposée dans le MVP.

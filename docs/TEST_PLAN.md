# INNOICA WhatsApp Agents — Plan de Test Global

**Version :** 2.0  
**Statut :** Plan Directeur de Qualification

---

## 1. Objectifs & Stratégie de Test

La qualification de la plateforme repose sur une suite de tests automatisés et de tests manuels structurés :

| Niveau de Test | Outils / Framework | Périmètre |
|---|---|---|
| **Unitaires** | Vitest | Fonctions pures, validation Zod, calculs de quotas, logique de formatage téléphonique, protection anti-SSRF, chiffrement/déchiffrement AES-256-GCM. |
| **Intégration** | Vitest + Supabase client | Politiques RLS, insertion de conversations/messages, transitions d'états d'agents, adaptateurs BYOK avec mocks de réponses. |
| **WhatsApp Worker** | Vitest + Baileys mocks & harness | Validation du numéro E.164, appel `requestPairingCode()`, gestion des événements de connexion, déduplication des messages, reconnexion. |
| **E2E & UI** | Playwright | Parcours complet : Inscription/Connexion, création d'agent, saisie du numéro, affichage du Pairing Code, bascule Human Takeover, paramétrage de clé BYOK. |
| **Sécurité** | Scripts de test de pénétration | Injection SQL, contournement RLS inter-workspaces, tentatives SSRF sur IP privées, fuite de clés API dans les logs. |

---

## 2. Matrice de Scénarios Clés

### 2.1 Connexion WhatsApp (Pairing Code Only)
- **TC-WA-01 :** Validation stricte d'un numéro camerounais (`+237691234567`) et international.
- **TC-WA-02 :** Rejet d'un numéro invalide ou trop court.
- **TC-WA-03 :** Demande de Pairing Code -> Émission du code à 8 chiffres sans aucun QR.
- **TC-WA-04 :** Détection de l'événement `connection.update: open` -> Passage immédiat de l'agent à l'état `connected`.
- **TC-WA-05 :** Test de déconnexion / révocation -> Clôture du socket et purge des credentials locaux.

### 2.2 Intelligence Artificielle (BYOK)
- **TC-AI-01 :** Enregistrement d'une clé API valide -> Chiffrement AES-256-GCM et masquage dans l'UI (`sk-...9f4a`).
- **TC-AI-02 :** Test de génération réussi avec OpenRouter / Groq / Gemini / OpenAI.
- **TC-AI-03 :** Clé invalide -> Retour d'erreur explicite sans crash du runtime.
- **TC-AI-04 :** Quota dépassé -> Notification claire et pas de fallback payant non consenti.

### 2.3 Contrôle Humain (Human Takeover)
- **TC-HT-01 :** Message entrant avec mode `ai_active` -> Génération et envoi de la réponse automatique.
- **TC-HT-02 :** Reprise manuelle par un opérateur -> Bascule en `human_takeover`.
- **TC-HT-03 :** Course critique : intervention humaine *pendant* l'appel LLM -> Annulation atomique de la réponse IA (Zero late reply).
- **TC-HT-04 :** Réactivation explicite par l'opérateur -> Rétablissement des réponses automatiques.

### 2.4 Protection SSRF (Base de Connaissances)
- **TC-KB-01 :** URL valide HTTPS publique -> Scraping autorisé et découpage en chunks.
- **TC-KB-02 :** URL pointant vers `http://127.0.0.1` ou `http://localhost` -> Rejet immédiat avec erreur de sécurité.
- **TC-KB-03 :** URL pointant vers `http://169.254.169.254` (metadata) -> Rejet immédiat.
- **TC-KB-04 :** URL pointant vers IP privée `192.168.1.1` -> Rejet immédiat.
- **TC-KB-05 :** Redirection sournoise d'un domaine public vers une IP privée -> Interception et blocage au saut de redirection.

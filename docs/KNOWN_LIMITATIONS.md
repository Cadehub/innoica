# Innoica Agent Studio — Limites Connues & Points en Attente

**Version :** 2.1  
**Statut :** Registre Transparent  

---

## 1. Contraintes Techniques Documentées

1. **Connecteur WhatsApp Baileys :**
   - Baileys repose sur le protocole WhatsApp Web et non sur la Cloud API officielle Meta. Les sessions peuvent être interrompues en cas de déconnexion manuelle depuis le téléphone, de limite d'appareils compagnons (max 4 sur WhatsApp) ou d'envoi massif non sollicité.
2. **Fournisseurs IA BYOK :**
   - Les agents dépendent de la validité, des limites de débit (rate limits) et du crédit disponible sur la clé API propre du client (Gemini, Groq, OpenRouter, OpenAI). « Illimité » sur Starter désigne l'absence de quota quotidien imposé par INNOICA, et non l'absence de limites chez le fournisseur IA ou Meta.
3. **Extraction PDF sans OCR :**
   - Les PDF contenant uniquement des images scannées sans couche texte sélectionnable renverront peu ou pas de texte exploitable (limite technique assumée dans cette version sans service OCR externe).
4. **Tests Manuels Temps Réel en Session Browser E2E :**
   - Les parcours d'envoi de messages WhatsApp live avec véritable appareil tiers dépendent d'un numéro WhatsApp réel connecté au Worker (`task-1588` vérifié connecté sur `+237695923604` durant la session). En sandbox E2E navigateur sur un compte Free vierge nouvellement inscrit, l'état vide de l'Inbox a été testé tandis que les transitions temps réel Realtime, la double garde Human Takeover et les quotas SQL ont été validés via Vitest et exécution SQL transactionnelle live.

---

## 2. Éléments en Attente de Configuration Externe (Hors Code)

1. **Poids Locaux Modèle Whisper (`faster-whisper base` INT8 CTranslate2) :**
   - Dans le bac à sable d'exécution local actuel (accès réseau sortant restreint hors ligne), les poids HuggingFace `Systran/faster-whisper-base` ne sont pas pré-téléchargés sur disque. `services/speech-worker` démarre proprement (`modelLoaded: false`, `modelError: "local_model_weights_missing"`) sans bloquer la plateforme et sans jamais appeler d'API payante. Sur le serveur de production connecté à Internet (`WHISPER_ALLOW_DOWNLOAD=true` ou via `WHISPER_MODEL_PATH`), le modèle `base` INT8 est téléchargé une seule fois dans le volume persistant `whisper_models` (`/app/models`).
2. **Paiement Mobile Money Automatisé (Webhook Opérateur) :** Les déclarations Orange Money / MTN MoMo sont enregistrées et approuvées manuellement par le Super Admin dans `/admin` jusqu'à raccordement d'un agrégateur de paiement camerounais avec clés API marchandes.
3. **Déploiement Contabo / Domaine Officiel HTTPS :** Le fichier `.env.production` et l'hébergement VPS Contabo avec DNS `agents.innoica.com` doivent être provisionnés côté infrastructure avant mise en production publique.
4. **Politique d'Emails Supabase Auth :** Dans l'environnement Supabase actuel, les inscriptions par e-mail se connectent immédiatement sans blocage par e-mail de confirmation ; activer *Confirm email* et configurer un serveur SMTP personnalisé dans Supabase Dashboard est recommandé avant ouverture publique.

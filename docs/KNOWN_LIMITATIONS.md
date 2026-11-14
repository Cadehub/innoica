# INNOICA WhatsApp Agents — Limites Connues et Contraintes Techniques

**Version :** 2.0  
**Statut :** Registre des Limites Documentées

---

## 1. Connecteur WhatsApp (Baileys)

1. **Solution non officielle Meta :**
   - Baileys est une bibliothèque rétro-conçue pour communiquer avec le protocole WhatsApp Web.
   - Les sessions peuvent être sujettes à des déconnexions en cas de mise à jour des serveurs WhatsApp ou de comportements suspects (envois massifs).
   - L'utilisateur en est explicitement averti dans l'interface INNOICA.

2. **Règle 1 numéro = 1 agent :**
   - Un compte WhatsApp ne peut être jumelé qu'à un nombre limité d'appareils compagnons (4 appareils max selon la règle native WhatsApp).
   - INNOICA réserve une session Baileys par agent.

---

## 2. Intelligence Artificielle (BYOK)

1. **Dépendance aux quotas du client :**
   - L'exécution des agents repose sur la validité et le crédit disponible sur la clé API fournie par le client (OpenRouter, Groq, Gemini, OpenAI).
   - Si le quota du client est épuisé, l'agent signale une erreur et cesse de répondre jusqu'à réapprovisionnement.

2. **Temps de latence :**
   - La latence globale de réponse comprend le transport réseau WhatsApp + l'inférence du LLM + la recherche documentaire RAG. Groq offre les réponses les plus rapides (<1s), tandis que les modèles lourds sur OpenRouter peuvent nécessiter 2 à 4 secondes.

---

## 3. Base de Connaissances & Documents

1. **Volume et formats :**
   - Taille maximale des fichiers PDF : 10 Mo.
   - Taille maximale des fichiers TXT : 5 Mo.
   - Les documents scannés sous forme d'images sans couche texte OCR ne sont pas transcrits dans cette version MVP.

# Innoica Agent Studio — Charte UX/UI & Ergonomie SaaS

**Version :** 2.1  
**Direction artistique :** Futuriste clair, haute lisibilité, équilibre 2D éditorial & profondeur 3D subtile  

---

## 1. Palette, Typographie & Principes Visuels

- **Fond principal :** Clair cristallin (`#f8fafc` / `#ffffff`) avec accents bleu électrique (`#2563eb` / `#1d4ed8`) et verre dépoli léger (`backdrop-blur`).
- **Typographie :** Plus Jakarta Sans / Inter, hiérarchie contrastée sur fond clair (`slate-900` titres, `slate-600` corps).
- **Zéro Emoji :** Aucun emoji dans le code source, les messages UI ou les réponses système — utilisation exclusive d'icônes vectorielles `lucide-react` uniformes.
- **Équilibre 2D / 3D :** Cartes planes nettes pour la productivité + profondeur 3D CSS discrète (perspectives et cartes flottantes) respectant strictement `@media (prefers-reduced-motion: reduce)`.

---

## 2. Shell SaaS Pleine Hauteur (`h-[100dvh]`)

- Sur desktop, la coque authentifiée (`apps/web/src/components/dashboard-shell.tsx`) occupe `100dvh` (`overflow-hidden`) afin d'éviter le double défilement global hérité des sites vitrines.
- **Barre latérale fixe (`256px`)** à gauche + **zone de travail principale** à droite avec défilement interne propre (`overflow-y-auto`) sur les pages de gestion, ou **0 scroll externe** sur l'Inbox WhatsApp Web (`/conversations`).
- **Responsive mobile (`390px`) :** Tiroir de navigation latéral activé par bouton menu, zéro débordement horizontal (`scrollWidth <= innerWidth`).

---

## 3. Inbox Inspirée de WhatsApp Web (`/conversations`)

1. **Architecture 3 colonnes :**
   - Colonne gauche (`w-80` / plein écran mobile quand aucune conversation sélectionnée) : recherche temps réel + filtres rapides (`Toutes`, `IA`, `Humain`, `Pause`), pastilles quota `X/10` pour le plan Free, badges non lus.
   - Colonne centrale (`flex-1 min-w-0`) : en-tête contact + sélecteur rapide `AI Active` / `Human Takeover` / `Paused` + chargement incrémental des messages anciens + bulles différenciées Contact / Agent IA / Humain + compositeur fixé en bas.
   - Colonne droite optionnelle (repliable) : fiche contact, `internal_notes` éditables, `contact_memories` durables et `conversation_memories`.
2. **Temps Réel Sans Doublon :** Écoute Supabase Realtime dédupliquée par `message.id`.

---

## 4. Champs Auto-Extensibles (`AutoGrowTextarea`)

- Composant partagé `apps/web/src/components/auto-grow-textarea.tsx`.
- Ajuste dynamiquement sa hauteur entre `minRows` et `maxHeightPx` selon `scrollHeight` à chaque saisie et au redimensionnement.
- Utilisé dans :
  - le compositeur de messages de l'Inbox (`/conversations`, avec bascule `Entrée` pour envoyer / `Maj+Entrée` pour retour à la ligne et préservation du texte saisi en cas d'erreur réseau) ;
  - la rédaction du prompt système (`/agents/new` et `/agents/[id]`) ;
  - le testeur d'agent et l'ajout de FAQ/TXT (`/knowledge`) ;
  - les notes de preuve de paiement (`/subscription`) et notes internes.

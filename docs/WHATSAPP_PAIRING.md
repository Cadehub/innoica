# INNOICA WhatsApp Agents — Spécification Connexion WhatsApp (Pairing Code)

**Version :** 2.0  
**Statut :** Règle Absolue & Spécification Technique

---

## 1. Règle Fondatrice Non Négociable

> **AUCUN QR CODE.**
> 
> L'unique méthode d'association d'un compte WhatsApp autorisée sur l'ensemble de la plateforme INNOICA est le **Pairing Code**.
> 
> Cette interdiction s'applique formellement :
> - Au code applicatif du frontend (aucun composant QR, aucun canvas, aucune librairie `qrcode`, `qr-scanner`, etc.).
> - Au code applicatif des workers et microservices (aucun QR terminal, aucun format base64 d'image QR).
> - Aux journaux d'erreurs, logs et outils de diagnostic.
> - À la documentation utilisateur et technique (ne jamais mentionner le QR code comme alternative ou secours).

---

## 2. Parcours Utilisateur

1. **Saisie du numéro international :**
   - L'utilisateur accède à l'onglet "Connexion WhatsApp" de son agent.
   - Il renseigne son numéro de téléphone au format international normalisé (ex: `+237691234567` ou `+33612345678`).
   - Le système valide le format E.164 côté client puis côté serveur.

2. **Demande de code :**
   - L'utilisateur clique sur le bouton **« Obtenir mon code de connexion »**.
   - Le backend envoie une commande au Worker WhatsApp via la file d'attente Redis.

3. **Génération côté Worker :**
   - Le Worker Baileys initialise le socket WhatsApp sans afficher de QR terminal (`printQRInTerminal: false`).
   - Le Worker invoque la méthode Baileys :
     ```typescript
     const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
     const pairingCode = await sock.requestPairingCode(cleanNumber);
     ```
   - Le code à 8 caractères (format type `ABCD-1234` ou 8 caractères alphanumériques groupés) est envoyé en temps réel au dashboard via Supabase Realtime / WebSocket.

4. **Association sur le téléphone :**
   - L'interface affiche le code avec un compte à rebours de validité et un bouton pour copier facilement.
   - Instructions affichées clairement à l'écran :
     1. Ouvrez WhatsApp sur votre smartphone.
     2. Allez dans **Réglages** (ou Menu 3 points) > **Appareils connectés**.
     3. Touchez **Associer un appareil**.
     4. Touchez l'option en bas : **« Associer avec un numéro de téléphone »**.
     5. Saisissez le code affiché sur INNOICA.

5. **Confirmation de connexion :**
   - Dès que l'utilisateur valide sur son téléphone, l'événement `connection.update` de Baileys avec `connection === 'open'` se déclenche côté Worker.
   - Le Worker met à jour la base de données : `status = 'connected'`.
   - Le dashboard bascule en direct vers l'état connecté.

---

## 3. Gestion Technique du Socket Baileys

```typescript
// Extrait d'implémentation du Worker Baileys (Zéro QR Code)
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';

export async function createAgentWhatsAppSession(params: {
  agentId: string;
  phoneNumber: string;
  onPairingCode: (code: string) => Promise<void>;
  onStatusChange: (status: string) => Promise<void>;
}) {
  const sessionDir = getAgentSessionDir(params.agentId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false, // OBLIGATOIRE : JAMAIS DE QR TERMINAL
    browser: ['INNOICA Agent', 'Chrome', '124.0.0'],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  // Si non encore enregistré, demande du Pairing Code
  if (!sock.authState.creds.registered) {
    const cleanNumber = params.phoneNumber.replace(/[^0-9]/g, '');
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(cleanNumber);
        await params.onPairingCode(code);
      } catch (err) {
        console.error(`[WA-Worker] Erreur génération Pairing Code pour agent ${params.agentId}:`, err);
      }
    }, 2000);
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect =
        (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      await params.onStatusChange(shouldReconnect ? 'reconnecting' : 'disconnected');
      if (shouldReconnect) {
        // Logique de reconnexion sécurisée avec backoff
      }
    } else if (connection === 'open') {
      await params.onStatusChange('connected');
    }
  });

  return sock;
}
```

---

## 4. Sécurité & Règles Anti-Abus

- **Règle 1 numéro = 1 agent :** Un numéro WhatsApp ne peut pas être associé à plus d'un agent simultanément dans le système.
- **Protection anti-flood :** Maximum 3 demandes de Pairing Code par fenêtre de 10 minutes pour un agent donné.
- **Isolation des sessions :** Chaque session de credentials Baileys est stockée dans un répertoire chiffré et étanche dédié à l'agent (`/sessions/{agent_id}/`). La défaillance ou corruption d'une session ne peut en aucun cas affecter une autre session.
- **Révocation instantanée :** L'utilisateur peut déconnecter son agent depuis son dashboard en un clic, ce qui déclenche `sock.logout()` et la suppression sécurisée des credentials locaux.

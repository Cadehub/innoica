// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Baileys Session Manager
// STRICT ZERO QR CODE POLICY: Pairing Code only via requestPairingCode
// ====================================================================

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket,
  proto,
} from '@whiskeysockets/baileys';
import fs from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import { normalizePhoneNumberForBaileys } from '@innoica/shared';
import { createWorkerSupabaseClient } from '@innoica/database';

export interface ActiveSession {
  agentId: string;
  phoneNumber: string;
  sock: WASocket;
  status: 'pending' | 'pairing' | 'connected' | 'disconnected' | 'error';
  pairingCode?: string;
  pairingCodeExpiresAt?: Date;
  retryCount: number;
}

export class WhatsAppSessionManager {
  private sessions = new Map<string, ActiveSession>();
  private baseSessionDir: string;
  private logger: pino.Logger;
  private supabase = createWorkerSupabaseClient();
  private onIncomingMessageCallback?: (agentId: string, msg: proto.IWebMessageInfo) => Promise<void>;

  constructor(sessionDir = './sessions') {
    this.baseSessionDir = path.resolve(sessionDir);
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    });
  }

  public setIncomingMessageHandler(handler: (agentId: string, msg: proto.IWebMessageInfo) => Promise<void>) {
    this.onIncomingMessageCallback = handler;
  }

  private getAgentSessionPath(agentId: string): string {
    return path.join(this.baseSessionDir, agentId);
  }

  /**
   * Initialise ou rétablit une session Baileys pour un agent.
   * Si la session n'est pas encore appairée, génère un Pairing Code.
   */
  public async startSession(agentId: string, phoneNumber: string): Promise<{ pairingCode?: string; status: string }> {
    const cleanNumber = normalizePhoneNumberForBaileys(phoneNumber);
    const sessionDir = this.getAgentSessionPath(agentId);

    // Vérifier si une session active existe déjà
    const existing = this.sessions.get(agentId);
    if (existing && existing.status === 'connected') {
      return { status: 'connected' };
    }

    await fs.mkdir(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    this.logger.info(`[WA-Worker] Initialisation socket pour agent ${agentId} (Baileys v${version.join('.')})`);

    // Configuration STRICTE SANS AUCUN QR CODE
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false, // INTERDICTION ABSOLUE DU QR
      logger: pino({ level: 'silent' }), // Réduit le bruit dans la console
      browser: ['INNOICA Agent', 'Chrome', '124.0.0'],
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });

    const activeSession: ActiveSession = {
      agentId,
      phoneNumber: cleanNumber,
      sock,
      status: state.creds.registered ? 'connected' : 'pairing',
      retryCount: 0,
    };
    this.sessions.set(agentId, activeSession);

    // Sauvegarde continue des identifiants d'authentification
    sock.ev.on('creds.update', saveCreds);

    // Gestion du cycle de vie de connexion
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        this.logger.warn(`[WA-Worker] Connexion fermée pour l'agent ${agentId}. Status code: ${statusCode}. Reconnexion: ${shouldReconnect}`);

        activeSession.status = shouldReconnect ? 'disconnected' : 'error';
        await this.updateDbConnectionStatus(agentId, activeSession.status, `Déconnexion code: ${statusCode}`);

        if (shouldReconnect && activeSession.retryCount < 5) {
          activeSession.retryCount++;
          const delayMs = Math.min(1000 * Math.pow(2, activeSession.retryCount), 30000);
          this.logger.info(`[WA-Worker] Tentative de reconnexion ${activeSession.retryCount}/5 dans ${delayMs}ms`);
          setTimeout(() => this.startSession(agentId, phoneNumber), delayMs);
        } else if (!shouldReconnect) {
          await this.destroySession(agentId);
        }
      } else if (connection === 'open') {
        this.logger.info(`[WA-Worker] ✅ Session WhatsApp CONNECTÉE avec succès pour l'agent ${agentId}`);
        activeSession.status = 'connected';
        activeSession.retryCount = 0;
        await this.updateDbConnectionStatus(agentId, 'connected');
      }
    });

    // Écoute des messages entrants
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        // Ignorer les messages de statut WhatsApp et les messages émis par soi-même
        if (msg.key.remoteJid === 'status@broadcast' || msg.key.fromMe) {
          continue;
        }

        if (this.onIncomingMessageCallback) {
          try {
            await this.onIncomingMessageCallback(agentId, msg);
          } catch (err) {
            this.logger.error(`[WA-Worker] Erreur traitement message entrant agent ${agentId}:`, err);
          }
        }
      }
    });

    // Si le compte n'est pas encore enregistré, demander le Pairing Code
    let pairingCode: string | undefined;
    if (!state.creds.registered) {
      activeSession.status = 'pairing';
      try {
        // Laisser 2 secondes au socket Baileys pour s'initialiser
        await new Promise((resolve) => setTimeout(resolve, 2000));
        pairingCode = await sock.requestPairingCode(cleanNumber);
        
        // Formater le code en groupe de 4 caractères pour une lisibilité maximale (ex: ABCD-1234)
        const formattedCode = pairingCode.length === 8 
          ? `${pairingCode.slice(0, 4)}-${pairingCode.slice(4)}`
          : pairingCode;

        activeSession.pairingCode = formattedCode;
        activeSession.pairingCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        this.logger.info(`[WA-Worker] 📱 Pairing Code généré pour l'agent ${agentId}: ${formattedCode}`);

        // Mise à jour de la base de données
        await this.supabase
          .from('whatsapp_connections')
          .update({
            status: 'pairing',
            pairing_code: formattedCode,
            pairing_code_expires_at: activeSession.pairingCodeExpiresAt.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('agent_id', agentId);

      } catch (err) {
        this.logger.error(`[WA-Worker] Échec génération Pairing Code pour agent ${agentId}:`, err);
        activeSession.status = 'error';
        await this.updateDbConnectionStatus(agentId, 'error', 'Erreur lors de la requête du Pairing Code');
        throw err;
      }
    }

    return {
      pairingCode: activeSession.pairingCode,
      status: activeSession.status,
    };
  }

  /**
   * Envoi d'un message texte sur WhatsApp via Baileys
   */
  public async sendMessage(agentId: string, toPhone: string, text: string): Promise<{ messageId: string }> {
    const session = this.sessions.get(agentId);
    if (!session || session.status !== 'connected') {
      throw new Error(`Agent ${agentId} n'est pas connecté à WhatsApp`);
    }

    const cleanRecipient = normalizePhoneNumberForBaileys(toPhone);
    const jid = `${cleanRecipient}@s.whatsapp.net`;

    const sent = await session.sock.sendMessage(jid, { text });
    if (!sent || !sent.key.id) {
      throw new Error("Échec d'envoi du message WhatsApp : aucun ID retourné");
    }

    this.logger.info(`[WA-Worker] Message envoyé à ${toPhone} par agent ${agentId} (ID: ${sent.key.id})`);
    return { messageId: sent.key.id };
  }

  /**
   * Déconnexion et révocation sécurisée de session
   */
  public async destroySession(agentId: string): Promise<void> {
    const session = this.sessions.get(agentId);
    if (session) {
      try {
        await session.sock.logout();
      } catch (err) {
        // Ignorer l'erreur si déjà déconnecté
      }
      this.sessions.delete(agentId);
    }

    const sessionDir = this.getAgentSessionPath(agentId);
    try {
      await fs.rm(sessionDir, { recursive: true, force: true });
    } catch (err) {
      // Ignorer
    }

    await this.updateDbConnectionStatus(agentId, 'disconnected', "Déconnecté par l'utilisateur");
    this.logger.info(`[WA-Worker] Session de l'agent ${agentId} fermée et supprimée du disque.`);
  }

  public getSessionStatus(agentId: string): { status: string; pairingCode?: string } {
    const session = this.sessions.get(agentId);
    if (!session) {
      return { status: 'disconnected' };
    }
    return {
      status: session.status,
      pairingCode: session.pairingCode,
    };
  }

  private async updateDbConnectionStatus(agentId: string, status: string, reason?: string) {
    try {
      const updatePayload: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (status === 'connected') {
        updatePayload.last_connected_at = new Date().toISOString();
        updatePayload.pairing_code = null;
        updatePayload.pairing_code_expires_at = null;
      }
      if (reason) {
        updatePayload.disconnect_reason = reason;
      }

      await this.supabase
        .from('whatsapp_connections')
        .update(updatePayload)
        .eq('agent_id', agentId);

      // Si connecté, synchroniser le statut de l'agent
      if (status === 'connected') {
        await this.supabase
          .from('agents')
          .update({ status: 'connected', updated_at: new Date().toISOString() })
          .eq('id', agentId);
      } else if (status === 'disconnected') {
        await this.supabase
          .from('agents')
          .update({ status: 'disconnected', updated_at: new Date().toISOString() })
          .eq('id', agentId);
      }
    } catch (err) {
      this.logger.error(`[WA-Worker] Erreur mise à jour statut base pour agent ${agentId}:`, err);
    }
  }
}

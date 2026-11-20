// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Baileys Session Manager
// STRICT ZERO QR CODE POLICY: Pairing Code only via requestPairingCode
// ====================================================================

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
  Browsers,
  WASocket,
  proto,
} from '@whiskeysockets/baileys';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
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
  lastActivityAt?: number;
  reconnectTimer?: NodeJS.Timeout;
  watchdogTimer?: NodeJS.Timeout;
}

export class WhatsAppSessionManager {
  private sessions = new Map<string, ActiveSession>();
  private sentMessageIds = new Set<string>();
  private messageStore = new Map<string, proto.IMessage>();
  private chatQueues = new Map<string, Promise<void>>();
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

  private shouldIgnoreRemoteJid(jid: string | null | undefined): boolean {
    if (!jid) return true;
    return (
      jid === 'status@broadcast' ||
      jid.endsWith('@g.us') ||
      jid.endsWith('@newsletter') ||
      jid.endsWith('@broadcast')
    );
  }

  private rememberMessage(keyId: string | null | undefined, message: proto.IMessage | null | undefined) {
    if (!keyId || !message) return;
    if (this.messageStore.size >= 500) {
      const oldestKey = this.messageStore.keys().next().value;
      if (oldestKey) this.messageStore.delete(oldestKey);
    }
    this.messageStore.set(keyId, message);
  }

  private clearSessionTimers(session: ActiveSession | undefined) {
    if (!session) return;
    if (session.reconnectTimer) {
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = undefined;
    }
    if (session.watchdogTimer) {
      clearInterval(session.watchdogTimer);
      session.watchdogTimer = undefined;
    }
  }

  private enqueueChatTask(queueKey: string, task: () => Promise<void>) {
    const prev = this.chatQueues.get(queueKey) ?? Promise.resolve();
    const next = prev
      .catch(() => {})
      .then(task)
      .finally(() => {
        if (this.chatQueues.get(queueKey) === next) {
          this.chatQueues.delete(queueKey);
        }
      });
    this.chatQueues.set(queueKey, next);
  }

  private startSessionWatchdog(agentId: string, sock: WASocket) {
    const session = this.sessions.get(agentId);
    if (!session || session.sock !== sock) return;
    if (session.watchdogTimer) {
      clearInterval(session.watchdogTimer);
    }

    let consecutiveFailures = 0;

    session.watchdogTimer = setInterval(async () => {
      const current = this.sessions.get(agentId);
      if (!current || current.sock !== sock) {
        if (session.watchdogTimer) clearInterval(session.watchdogTimer);
        return;
      }
      if (current.status !== 'connected') return;

      const wsOpen = Boolean((sock as any)?.ws?.isOpen);
      if (!wsOpen) {
        this.logger.warn(`[WA-Worker] Watchdog: WebSocket fermé silencieusement pour agent ${agentId}. Reconnexion...`);
        this.forceReconnect(agentId, sock, 'ws_closed_silently');
        return;
      }

      // Si des messages récents ont été reçus/envoyés dans les 60s, la session est vivante
      if (Date.now() - (current.lastActivityAt ?? 0) < 60000) {
        consecutiveFailures = 0;
        return;
      }

      try {
        await Promise.race([
          sock.query({ tag: 'iq', attrs: { to: '@s.whatsapp.net', type: 'get', xmlns: 'w:p' }, content: [] }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('iq_ping_timeout')), 30000)),
        ]);
        consecutiveFailures = 0;
        current.lastActivityAt = Date.now();
      } catch (err: any) {
        consecutiveFailures++;
        this.logger.warn(
          `[WA-Worker] Watchdog: ping WhatsApp échoué (${consecutiveFailures}/2) pour agent ${agentId} (${err?.message || 'timeout'}).`
        );
        if (consecutiveFailures >= 2) {
          this.forceReconnect(agentId, sock, 'watchdog_ping_timeout');
        }
      }
    }, 45000);
  }

  private forceReconnect(agentId: string, expectedSock: WASocket, reason: string) {
    const current = this.sessions.get(agentId);
    if (!current || current.sock !== expectedSock) return;
    this.clearSessionTimers(current);
    try {
      expectedSock.ev.removeAllListeners('connection.update');
      expectedSock.ev.removeAllListeners('creds.update');
      expectedSock.ev.removeAllListeners('messages.upsert');
      expectedSock.end(new Error(reason));
    } catch {
      // Ignorer
    }
    current.status = 'disconnected';
    current.reconnectTimer = setTimeout(() => {
      const latest = this.sessions.get(agentId);
      if (latest) latest.reconnectTimer = undefined;
      this.startSession(agentId, current.phoneNumber, { isReconnect: true }).catch((err) => {
        this.logger.error({ err }, `[WA-Worker] Échec reconnexion watchdog agent ${agentId}`);
      });
    }, 1500);
  }

  private getAgentSessionPath(agentId: string): string {
    return path.join(this.baseSessionDir, agentId);
  }

  /**
   * Initialise ou rétablit une session Baileys pour un agent.
   * Si la session n'est pas encore appairée, génère un Pairing Code.
   */
  public async startSession(
    agentId: string,
    phoneNumber: string,
    options: { isReconnect?: boolean } = {}
  ): Promise<{ pairingCode?: string; status: string }> {
    const cleanNumber = normalizePhoneNumberForBaileys(phoneNumber);
    const sessionDir = this.getAgentSessionPath(agentId);

    // Fermer proprement tout socket précédent pour cet agent afin d'éviter
    // les conflits de session ou la régénération parasite du Pairing Code
    const existing = this.sessions.get(agentId);
    if (existing) {
      if (existing.status === 'connected' && !options.isReconnect && Boolean((existing.sock as any)?.ws?.isOpen)) {
        return { status: 'connected' };
      }
      this.clearSessionTimers(existing);
      try {
        existing.sock.ev.removeAllListeners('connection.update');
        existing.sock.ev.removeAllListeners('creds.update');
        existing.sock.ev.removeAllListeners('messages.upsert');
        existing.sock.end(undefined);
      } catch {
        // Ignorer les erreurs de fermeture d'un ancien socket
      }
      this.sessions.delete(agentId);
    }

    // Lors d'une nouvelle demande manuelle d'appairage, repartir d'un état auth propre
    if (!options.isReconnect) {
      await fs.rm(sessionDir, { recursive: true, force: true });
    }

    await fs.mkdir(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    let version: [number, number, number];
    try {
      const waWeb = await fetchLatestWaWebVersion({});
      version = waWeb.version;
    } catch {
      const fallback = await fetchLatestBaileysVersion();
      version = fallback.version;
    }

    this.logger.info(`[WA-Worker] Initialisation socket pour agent ${agentId} (Baileys v${version.join('.')})`);

    // Configuration STRICTE SANS AUCUN QR CODE avec auto-guérison des sessions Signal corrompues (Bad MAC)
    const selfLogger = this.logger;
    const baileysLogger = pino({
      level: process.env.BAILEYS_LOG_LEVEL || 'info',
      hooks: {
        logMethod(inputArgs, method) {
          const first = inputArgs[0] as any;
          if (
            first &&
            typeof first === 'object' &&
            (first.err?.type === 'SessionError' ||
              first.error?.name === 'SessionError' ||
              String(first.msg || '').includes('failed to decrypt message') ||
              String(first.err?.message || '').includes('Bad MAC'))
          ) {
            const rawTargetJid = first.key?.remoteJid || first.jid || first.sender || first.author || '';
            if (rawTargetJid) {
              const targetBase = String(rawTargetJid).split('@')[0].split(':')[0].replace(/\D/g, '');
              if (targetBase && targetBase.length >= 5) {
                fs.readdir(sessionDir)
                  .then((files) => {
                    for (const f of files) {
                      if (f.startsWith(`session-${targetBase}`) || f.startsWith(`session-${rawTargetJid}`)) {
                        fs.unlink(path.join(sessionDir, f)).catch(() => {});
                        selfLogger.warn(
                          `[WA-Worker] 🛡️ Auto-guérison Signal : suppression de la session corrompue ${f} pour débloquer la communication avec ${rawTargetJid}`
                        );
                      }
                    }
                  })
                  .catch(() => {});
              }
            }
          }
          return method.apply(this, inputArgs as any);
        },
      },
    });
    const createSocket = (makeWASocket as any).default ?? makeWASocket;
    const browserConfig = (Browsers as any)?.macOS?.('Chrome') ?? ['Mac OS', 'Chrome', '14.4.1'];
    const cacheableKeys =
      typeof makeCacheableSignalKeyStore === 'function'
        ? makeCacheableSignalKeyStore(state.keys, baileysLogger)
        : state.keys;

    const sock: WASocket = createSocket({
      version,
      auth: {
        creds: state.creds,
        keys: cacheableKeys,
      },
      printQRInTerminal: false, // INTERDICTION ABSOLUE DU QR
      logger: baileysLogger,
      browser: browserConfig,
      markOnlineOnConnect: true,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      shouldIgnoreJid: (jid: string) => this.shouldIgnoreRemoteJid(jid),
      getMessage: async (key: proto.IMessageKey) => (key.id ? this.messageStore.get(key.id) : undefined),
    });

    const activeSession: ActiveSession = {
      agentId,
      phoneNumber:
        cleanNumber ||
        (state?.creds?.me?.id ? state.creds.me.id.split('@')[0].split(':')[0].replace(/\D/g, '') : ''),
      sock,
      status: state.creds.registered ? 'connected' : 'pairing',
      retryCount: existing?.retryCount ?? 0,
      lastActivityAt: Date.now(),
    };
    this.sessions.set(agentId, activeSession);

    // Sauvegarde continue des identifiants d'authentification
    sock.ev.on('creds.update', saveCreds);

    // Journalisation diagnostique brute des stanzas CB:message / CB:ib reçues sur le WebSocket
    try {
      (sock as any).ws?.on?.('CB:message', (node: any) => {
        const a = node?.attrs || {};
        this.logger.info(
          `[WA-Raw] CB:message agent=${agentId} from=${a.from || ''} participant=${a.participant || ''} id=${a.id || ''} type=${a.type || ''} offline=${a.offline || ''}`
        );
        // Libération immédiate de l'event-buffer Baileys pour un dispatch temps réel sans blocage
        setImmediate(() => {
          if (this.sessions.get(agentId)?.sock === sock) {
            try {
              (sock.ev as any)?.flush?.();
            } catch {}
          }
        });
      });
      (sock as any).ws?.on?.('CB:ib', (node: any) => {
        const children = Array.isArray(node?.content)
          ? node.content.map((c: any) => c?.tag || 'unknown').join(',')
          : '';
        this.logger.info(`[WA-Raw] CB:ib agent=${agentId} children=[${children}]`);
        if (children.split(',').includes('offline')) {
          setImmediate(() => {
            if (this.sessions.get(agentId)?.sock === sock) {
              try {
                (sock.ev as any)?.flush?.();
              } catch {}
            }
          });
        }
      });
    } catch {
      // Ignorer si ws non attaché dans un environnement mocké
    }

    // Promesse résolue dès que Baileys est prêt pour l'appairage (événement qr reçu)
    let resolveReady: (() => void) | null = null;
    const readyForPairing = new Promise<void>((resolve) => {
      resolveReady = resolve;
    });

    // Gestion du cycle de vie de connexion
    sock.ev.on('connection.update', async (update) => {
      // Ignorer les événements d'un socket remplacé
      if (this.sessions.get(agentId)?.sock !== sock) return;

      const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications, isOnline } = update;
      if (connection || isNewLogin || typeof receivedPendingNotifications !== 'undefined' || typeof isOnline !== 'undefined') {
        this.logger.info(
          `[WA-Worker] connection.update agent=${agentId} connection=${connection} isNewLogin=${Boolean(isNewLogin)} pendingNotifs=${String(receivedPendingNotifications)} isOnline=${String(isOnline)}`
        );
      }

      if (typeof receivedPendingNotifications !== 'undefined' && receivedPendingNotifications) {
        try {
          (sock.ev as any)?.flush?.();
        } catch {}
      }

      if (qr && resolveReady) {
        resolveReady();
        resolveReady = null;
      }

      if (connection === 'close') {
        this.clearSessionTimers(activeSession);
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isRestartRequired = statusCode === DisconnectReason.restartRequired;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const shouldReconnect =
          !isLoggedOut && (state.creds.registered || isRestartRequired);

        this.logger.warn(`[WA-Worker] Connexion fermée pour l'agent ${agentId}. Status code: ${statusCode}. Reconnexion: ${shouldReconnect}`);

        activeSession.status = shouldReconnect ? 'disconnected' : 'error';
        await this.updateDbConnectionStatus(agentId, activeSession.status, `Déconnexion code: ${statusCode}`);

        if (shouldReconnect && activeSession.retryCount < 100) {
          activeSession.retryCount++;
          const delayMs = isRestartRequired
            ? 500
            : Math.min(2000 * Math.pow(2, Math.min(activeSession.retryCount, 5)), 60000);
          this.logger.info(`[WA-Worker] Tentative de reconnexion ${activeSession.retryCount}/100 dans ${delayMs}ms`);
          activeSession.reconnectTimer = setTimeout(() => {
            activeSession.reconnectTimer = undefined;
            this.startSession(agentId, phoneNumber, { isReconnect: true }).catch((err) => {
              this.logger.error({ err }, `[WA-Worker] Échec reconnexion agent ${agentId}`);
            });
          }, delayMs);
        } else if (isLoggedOut) {
          await this.destroySession(agentId);
        }
      } else if (connection === 'open') {
        this.logger.info(`[WA-Worker] Session WhatsApp CONNECTÉE avec succès pour l'agent ${agentId}`);
        activeSession.status = 'connected';
        activeSession.retryCount = 0;
        activeSession.lastActivityAt = Date.now();
        this.startSessionWatchdog(agentId, sock);
        await this.updateDbConnectionStatus(agentId, 'connected');

        // Flush immédiat et complet de l'event-buffer Baileys
        try {
          (sock.ev as any)?.flush?.();
        } catch {}

        // Déclaration active de présence 'available' pour indiquer à WhatsApp que le client est en ligne
        try {
          if (!sock.user?.name && (state.creds.me as any)?.name) {
            if (!sock.user) sock.user = { id: state.creds.me?.id || `${cleanNumber}@s.whatsapp.net`, name: (state.creds.me as any).name };
            else sock.user.name = (state.creds.me as any).name;
          }
          await sock.sendPresenceUpdate('available');
          this.logger.info(`[WA-Worker] Statut de présence 'available' envoyé avec succès pour agent ${agentId}`);
        } catch (err: any) {
          this.logger.warn(`[WA-Worker] Envoi présence 'available' non bloquant agent ${agentId}: ${err?.message}`);
        }

        // Flushes de sécurité complémentaires rapprochés (200ms et 1000ms)
        setTimeout(() => {
          if (this.sessions.get(agentId)?.sock === sock) {
            try {
              (sock.ev as any)?.flush?.();
            } catch {}
          }
        }, 200);
        setTimeout(() => {
          if (this.sessions.get(agentId)?.sock === sock) {
            try {
              (sock.ev as any)?.flush?.();
            } catch {}
          }
        }, 1000);
      }
    });

    // Écoute des messages entrants
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (this.sessions.get(agentId)?.sock !== sock) return;
      activeSession.lastActivityAt = Date.now();
      this.logger.info(`[WA-Worker] messages.upsert agent=${agentId} type=${type} count=${messages.length}`);
      if (type !== 'notify' && type !== 'append') return;

      const ownUserPhone = (sock.user?.id || (sock as any)?.authState?.creds?.me?.id || activeSession.phoneNumber)?.split(':')[0]?.split('@')[0];
      const ownUserLid = ((sock.user as any)?.lid || (sock as any)?.authState?.creds?.me?.lid)?.split(':')[0]?.split('@')[0];

      for (const msg of messages) {
        const jid = msg.key?.remoteJid || '';
        let altJid = (msg.key as any)?.remoteJidAlt || '';
        const msgId = msg.key?.id || '';

        if (!altJid && jid.endsWith('@lid')) {
          try {
            const pn = await (sock as any)?.signalRepository?.lidMapping?.getPNForLID?.(jid);
            if (pn) {
              altJid = String(pn);
              (msg.key as any).remoteJidAlt = altJid;
            }
          } catch {
            // Ignorer si mapping PN indisponible
          }
        }

        const jidBase = jid.split('@')[0].split(':')[0];
        const altBase = altJid.split('@')[0].split(':')[0];

        const isSelfChat =
          (Boolean(ownUserPhone) && (jidBase === ownUserPhone || altBase === ownUserPhone)) ||
          (Boolean(activeSession.phoneNumber) && (jidBase === activeSession.phoneNumber || altBase === activeSession.phoneNumber)) ||
          (Boolean(ownUserLid) && (jidBase === ownUserLid || altBase === ownUserLid));

        const isBotOwnEcho = msgId ? this.sentMessageIds.has(msgId) : false;

        let rawTs = (msg.messageTimestamp as any)?.toNumber
          ? (msg.messageTimestamp as any).toNumber()
          : Number(msg.messageTimestamp ?? 0);
        if (rawTs > 1000000000000) {
          rawTs = Math.floor(rawTs / 1000);
        }
        const isRecentMsg = rawTs === 0 || (Date.now() / 1000 - rawTs) <= 3600;

        const allowSelfTest = Boolean(
          msg.key?.fromMe && isSelfChat && isRecentMsg && !isBotOwnEcho
        );

        if (
          this.shouldIgnoreRemoteJid(jid) ||
          isBotOwnEcho ||
          (msg.key?.fromMe && !allowSelfTest)
        ) {
          this.logger.info(
            `[WA-Worker] Message ignoré agent=${agentId} jid=${jid} alt=${altJid} fromMe=${Boolean(msg.key?.fromMe)} selfChat=${isSelfChat} botEcho=${isBotOwnEcho}`
          );
          continue;
        }

        this.rememberMessage(msgId, msg.message);

        if (this.onIncomingMessageCallback) {
          const handler = this.onIncomingMessageCallback;
          this.enqueueChatTask(`${agentId}:${jidBase || jid}`, async () => {
            try {
              await handler(agentId, msg);
            } catch (err) {
              this.logger.error({ err }, `[WA-Worker] Erreur traitement message entrant agent ${agentId}`);
            }
          });
        }
      }
    });

    // Traitement des messages d'historique récents reçus lors d'une reconnexion (messaging-history.set)
    sock.ev.on('messaging-history.set', async ({ messages }: { messages?: proto.IWebMessageInfo[] }) => {
      if (this.sessions.get(agentId)?.sock !== sock) return;
      if (!messages || messages.length === 0) return;
      activeSession.lastActivityAt = Date.now();
      const nowSec = Math.floor(Date.now() / 1000);
      const recentInboundMessages = messages.filter((m) => {
        let rawTs = (m.messageTimestamp as any)?.toNumber
          ? (m.messageTimestamp as any).toNumber()
          : Number(m.messageTimestamp ?? 0);
        if (rawTs > 1000000000000) rawTs = Math.floor(rawTs / 1000);
        const isRecent = rawTs > 0 && (nowSec - rawTs) <= 600;
        return isRecent && !m.key?.fromMe;
      });

      if (recentInboundMessages.length > 0) {
        this.logger.info(
          `[WA-Worker] Traitement de ${recentInboundMessages.length} message(s) offline récent(s) reçu(s) via messaging-history.set pour agent ${agentId}`
        );
        for (const msg of recentInboundMessages) {
          const jid = msg.key?.remoteJid || '';
          const msgId = msg.key?.id || '';
          if (this.shouldIgnoreRemoteJid(jid)) continue;
          if (msgId && this.sentMessageIds.has(msgId)) continue;
          this.rememberMessage(msgId, msg.message);
          if (this.onIncomingMessageCallback) {
            const handler = this.onIncomingMessageCallback;
            const jidBase = jid.split('@')[0].split(':')[0];
            this.enqueueChatTask(`${agentId}:${jidBase || jid}`, async () => {
              try {
                await handler(agentId, msg);
              } catch (err) {
                this.logger.error({ err }, `[WA-Worker] Erreur traitement message offline agent ${agentId}`);
              }
            });
          }
        }
      }
    });

    // Si le compte n'est pas encore enregistré, attendre que le socket soit prêt puis demander le Pairing Code
    if (!state.creds.registered) {
      activeSession.status = 'pairing';
      try {
        await Promise.race([
          readyForPairing,
          new Promise((resolve) => setTimeout(resolve, 4000)),
        ]);

        const rawCode = await sock.requestPairingCode(cleanNumber);
        const formattedCode =
          rawCode.length === 8 ? `${rawCode.slice(0, 4)}-${rawCode.slice(4)}` : rawCode;

        activeSession.pairingCode = formattedCode;
        activeSession.pairingCodeExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        this.logger.info(`[WA-Worker] Pairing Code généré pour l'agent ${agentId}: ${formattedCode}`);

        await this.supabase.rpc('worker_update_wa_status', {
          p_agent_id: agentId,
          p_status: 'pairing',
          p_pairing_code: formattedCode,
          p_pairing_expires_at: activeSession.pairingCodeExpiresAt.toISOString(),
          p_reason: null,
          p_worker_secret: process.env.WORKER_INTERNAL_SECRET || null,
        });
      } catch (err) {
        this.logger.error({ err }, `[WA-Worker] Échec génération Pairing Code pour agent ${agentId}`);
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

    const jid = toPhone.includes('@')
      ? toPhone
      : `${normalizePhoneNumberForBaileys(toPhone)}@s.whatsapp.net`;

    const preMessageId = `3EB0${crypto.randomBytes(9).toString('hex').toUpperCase()}`;
    if (this.sentMessageIds.size > 2000) {
      this.sentMessageIds.clear();
    }
    this.sentMessageIds.add(preMessageId);

    const sent = await session.sock.sendMessage(jid, { text }, { messageId: preMessageId } as any);
    const finalId = sent?.key?.id || preMessageId;
    this.sentMessageIds.add(finalId);
    this.rememberMessage(finalId, sent?.message || { conversation: text });
    session.lastActivityAt = Date.now();

    this.logger.info(`[WA-Worker] Message envoyé à ${toPhone} par agent ${agentId} (ID: ${finalId})`);
    return { messageId: finalId };
  }

  /**
   * Envoi d'un indicateur de présence en temps réel ('composing' | 'paused' | 'recording' | 'available')
   */
  public async sendPresence(
    agentId: string,
    toJid: string,
    presence: 'composing' | 'paused' | 'recording' | 'available'
  ): Promise<void> {
    const session = this.sessions.get(agentId);
    if (!session || session.status !== 'connected') return;

    try {
      if (presence === 'available' || !toJid) {
        await session.sock.sendPresenceUpdate('available');
        return;
      }

      const jid = toJid.includes('@')
        ? toJid
        : `${normalizePhoneNumberForBaileys(toJid)}@s.whatsapp.net`;

      await session.sock.sendPresenceUpdate(presence, jid);
      this.logger.debug(`[WA-Worker] Présence ${presence} envoyée vers ${jid} pour agent ${agentId}`);
    } catch (err: any) {
      this.logger.debug(`[WA-Worker] Échec sendPresenceUpdate (${presence}) agent ${agentId}: ${err?.message}`);
    }
  }

  /**
   * Récupération de tous les groupes WhatsApp auxquels le compte participe
   */
  public async fetchParticipatingGroups(agentId: string) {
    const session = this.sessions.get(agentId);
    if (!session || session.status !== 'connected') {
      throw new Error(`Agent ${agentId} n'est pas connecté à WhatsApp`);
    }

    const groups = await session.sock.groupFetchAllParticipating();
    const myJid = session.sock.user?.id;
    const myNumber = myJid ? myJid.split('@')[0].split(':')[0] : '';

    return Object.values(groups).map((g) => {
      const isBotAdmin = g.participants?.some(
        (p: any) =>
          (p.id?.includes(myNumber) || p.id === myJid) &&
          (p.admin === 'admin' || p.admin === 'superadmin')
      );
      return {
        id: g.id,
        subject: g.subject,
        subjectOwner: g.subjectOwner,
        subjectTime: g.subjectTime,
        size: g.size || g.participants?.length || 0,
        creation: g.creation,
        owner: g.owner,
        desc: g.desc,
        descId: g.descId,
        restrict: g.restrict,
        announce: g.announce,
        isBotAdmin: Boolean(isBotAdmin),
        participantsCount: g.participants?.length || 0,
      };
    });
  }

  /**
   * Métadonnées détaillées d'un groupe spécifique
   */
  public async getGroupMetadata(agentId: string, groupJid: string) {
    const session = this.sessions.get(agentId);
    if (!session || session.status !== 'connected') {
      throw new Error(`Agent ${agentId} n'est pas connecté à WhatsApp`);
    }
    return await session.sock.groupMetadata(groupJid);
  }

  /**
   * Modification du sujet (nom) d'un groupe
   */
  public async updateGroupSubject(agentId: string, groupJid: string, subject: string) {
    const session = this.sessions.get(agentId);
    if (!session || session.status !== 'connected') {
      throw new Error(`Agent ${agentId} n'est pas connecté à WhatsApp`);
    }
    return await session.sock.groupUpdateSubject(groupJid, subject);
  }

  /**
   * Modification de la description d'un groupe
   */
  public async updateGroupDescription(agentId: string, groupJid: string, description: string) {
    const session = this.sessions.get(agentId);
    if (!session || session.status !== 'connected') {
      throw new Error(`Agent ${agentId} n'est pas connecté à WhatsApp`);
    }
    return await session.sock.groupUpdateDescription(groupJid, description);
  }

  /**
   * Gestion des participants d'un groupe (add, remove, promote, demote)
   */
  public async manageGroupParticipants(
    agentId: string,
    groupJid: string,
    participants: string[],
    action: 'add' | 'remove' | 'promote' | 'demote'
  ) {
    const session = this.sessions.get(agentId);
    if (!session || session.status !== 'connected') {
      throw new Error(`Agent ${agentId} n'est pas connecté à WhatsApp`);
    }
    const formattedParticipants = participants.map((p) =>
      p.includes('@') ? p : `${normalizePhoneNumberForBaileys(p)}@s.whatsapp.net`
    );
    return await session.sock.groupParticipantsUpdate(groupJid, formattedParticipants, action);
  }

  /**
   * Modification des paramètres de diffusion d'un groupe
   */
  public async updateGroupSettings(
    agentId: string,
    groupJid: string,
    setting: 'announcement' | 'not_announcement' | 'locked' | 'unlocked'
  ) {
    const session = this.sessions.get(agentId);
    if (!session || session.status !== 'connected') {
      throw new Error(`Agent ${agentId} n'est pas connecté à WhatsApp`);
    }
    return await session.sock.groupSettingUpdate(groupJid, setting);
  }

  /**
   * Métadonnées d'une chaîne WhatsApp (Newsletter)
   */
  public async getChannelMetadata(agentId: string, channelJid: string) {
    const session = this.sessions.get(agentId);
    if (!session || session.status !== 'connected') {
      throw new Error(`Agent ${agentId} n'est pas connecté à WhatsApp`);
    }
    return await session.sock.newsletterMetadata('jid', channelJid);
  }

  /**
   * Déconnexion et révocation sécurisée de session
   */
  public async destroySession(agentId: string): Promise<void> {
    const session = this.sessions.get(agentId);
    if (session) {
      this.clearSessionTimers(session);
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

  public async restoreAllSessions(): Promise<void> {
    try {
      await fs.mkdir(this.baseSessionDir, { recursive: true });
      const entries = await fs.readdir(this.baseSessionDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const agentId = entry.name;
        const credsPath = path.join(this.baseSessionDir, agentId, 'creds.json');
        try {
          const raw = await fs.readFile(credsPath, 'utf-8');
          const creds = JSON.parse(raw);
          if (creds?.registered || creds?.me?.id) {
            const registeredPhone = creds?.me?.id
              ? creds.me.id.split('@')[0].split(':')[0].replace(/\D/g, '')
              : '';
            this.logger.info(
              `[WA-Worker] Restauration automatique de la session pour l'agent ${agentId}${registeredPhone ? ` (phone: +${registeredPhone})` : ''}`
            );
            this.startSession(agentId, registeredPhone ? `+${registeredPhone}` : '', { isReconnect: true }).catch((err) => {
              this.logger.error({ err }, `[WA-Worker] Échec restauration session ${agentId}`);
            });
          }
        } catch {
          // Pas de creds.json valide pour ce dossier
        }
      }
    } catch (err) {
      this.logger.error({ err }, '[WA-Worker] Erreur lors de la restauration des sessions');
    }
  }

  public getSessionStatus(agentId: string): {
    status: string;
    pairingCode?: string;
    wsOpen?: boolean;
    lastActivityAt?: string;
  } {
    const session = this.sessions.get(agentId);
    if (!session) {
      return { status: 'disconnected', wsOpen: false };
    }
    return {
      status: session.status,
      pairingCode: session.pairingCode,
      wsOpen: Boolean((session.sock as any)?.ws?.isOpen),
      lastActivityAt: session.lastActivityAt ? new Date(session.lastActivityAt).toISOString() : undefined,
    };
  }

  public async verifySessionHealth(agentId: string): Promise<{
    status: string;
    wsOpen: boolean;
    livePingOk: boolean;
    pingMs?: number;
    error?: string;
  }> {
    const session = this.sessions.get(agentId);
    if (!session) {
      return { status: 'disconnected', wsOpen: false, livePingOk: false, error: 'session_not_found' };
    }

    const wsOpen = Boolean((session.sock as any)?.ws?.isOpen);
    if (!wsOpen || session.status !== 'connected') {
      return { status: session.status, wsOpen, livePingOk: false, error: 'socket_not_open' };
    }

    const startedAt = Date.now();
    try {
      await Promise.race([
        session.sock.query({ tag: 'iq', attrs: { to: '@s.whatsapp.net', type: 'get', xmlns: 'w:p' }, content: [] }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('iq_ping_timeout')), 8000)),
      ]);
      session.lastActivityAt = Date.now();
      return { status: session.status, wsOpen: true, livePingOk: true, pingMs: Date.now() - startedAt };
    } catch (err: any) {
      this.forceReconnect(agentId, session.sock, 'manual_ping_failed');
      return {
        status: 'reconnecting',
        wsOpen: false,
        livePingOk: false,
        error: err?.message || 'ping_failed',
      };
    }
  }

  public async downloadIncomingMediaBuffer(agentId: string, msg: proto.IWebMessageInfo): Promise<Buffer> {
    const session = this.sessions.get(agentId);
    if (!session || session.status !== 'connected') {
      throw new Error(`Session WhatsApp inactive pour télécharger le média (${agentId})`);
    }
    const downloaded = await downloadMediaMessage(
      msg as any,
      'buffer',
      {},
      {
        logger: this.logger as any,
        reuploadRequest: session.sock.updateMediaMessage,
      }
    );
    return Buffer.isBuffer(downloaded) ? downloaded : Buffer.from(downloaded);
  }

  private async updateDbConnectionStatus(agentId: string, status: string, reason?: string) {
    try {
      const { error } = await this.supabase.rpc('worker_update_wa_status', {
        p_agent_id: agentId,
        p_status: status,
        p_pairing_code: null,
        p_pairing_expires_at: null,
        p_reason: reason || null,
        p_worker_secret: process.env.WORKER_INTERNAL_SECRET || null,
      });

      if (error) {
        this.logger.error({ err: error }, `[WA-Worker] RPC worker_update_wa_status échoué pour agent ${agentId}`);
      }
    } catch (err) {
      this.logger.error({ err }, `[WA-Worker] Erreur mise à jour statut base pour agent ${agentId}`);
    }
  }
}

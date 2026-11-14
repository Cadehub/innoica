// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Server-Side AES-256-GCM Encryption
// ====================================================================

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 16 bytes for GCM
const AUTH_TAG_LENGTH = 16; // 16 bytes

/**
 * Récupère et valide la clé maîtresse AES-256 (32 octets = 64 caractères hex)
 */
export function getMasterEncryptionKey(customKey?: string): Buffer {
  const hexKey = customKey || process.env.ENCRYPTION_MASTER_KEY;
  if (!hexKey) {
    throw new Error("ENCRYPTION_MASTER_KEY n'est pas configurée dans les variables d'environnement");
  }
  if (hexKey.length !== 64) {
    throw new Error("ENCRYPTION_MASTER_KEY doit comporter exactement 64 caractères hexadécimaux (32 octets)");
  }
  return Buffer.from(hexKey, 'hex');
}

/**
 * Chiffre un texte en clair avec AES-256-GCM
 * Format de sortie : `iv:authTag:ciphertext` (en hexadécimal)
 */
export function encryptSecret(plainText: string, masterKeyBuffer?: Buffer): string {
  if (!plainText) {
    throw new Error("Le texte à chiffrer ne peut pas être vide");
  }

  const key = masterKeyBuffer || getMasterEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Déchiffre un secret chiffré au format `iv:authTag:ciphertext`
 */
export function decryptSecret(encryptedPayload: string, masterKeyBuffer?: Buffer): string {
  if (!encryptedPayload) {
    throw new Error('Le payload chiffré ne peut pas être vide');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Format de payload chiffré invalide (attendu: iv:authTag:ciphertext)');
  }

  const [ivHex, authTagHex, cipherHex] = parts;
  const key = masterKeyBuffer || getMasterEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Masque une clé API pour l'affichage sécurisé dans le dashboard
 * Exemple : `sk-proj-1234567890abcdef` -> `sk-...cdef`
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return '••••••••';
  }
  const prefix = apiKey.startsWith('sk-') ? 'sk-...' : '...';
  const lastFour = apiKey.slice(-4);
  return `${prefix}${lastFour}`;
}

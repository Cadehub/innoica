// ====================================================================
// INNOICA WhatsApp Agents v2.0 — Anti-SSRF Security Validator
// ====================================================================

import dns from 'node:dns/promises';
import net from 'node:net';

export interface SSRFValidationResult {
  isSafe: boolean;
  reason?: string;
  resolvedIp?: string;
}

/**
 * Vérifie si une adresse IPv4 ou IPv6 appartient à une plage privée, réservée ou loopback
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (!net.isIP(ip)) {
    return true; // Si ce n'est pas une IP valide, considérer comme non sécurisée
  }

  // IPv4 Checks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [p0, p1] = parts;

    // 0.0.0.0/8 (Current network)
    if (p0 === 0) return true;

    // 10.0.0.0/8 (Private network Class A)
    if (p0 === 10) return true;

    // 100.64.0.0/10 (Carrier-grade NAT)
    if (p0 === 100 && p1 >= 64 && p1 <= 127) return true;

    // 127.0.0.0/8 (Loopback / Localhost)
    if (p0 === 127) return true;

    // 169.254.0.0/16 (Link-Local & Cloud Metadata AWS/GCP/DigitalOcean/Contabo)
    if (p0 === 169 && p1 === 254) return true;

    // 172.16.0.0/12 (Private network Class B: 172.16.0.0 to 172.31.255.255)
    if (p0 === 172 && p1 >= 16 && p1 <= 31) return true;

    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (p0 === 192 && p1 === 0 && parts[2] === 0) return true;

    // 192.0.2.0/24 (TEST-NET-1)
    if (p0 === 192 && p1 === 0 && parts[2] === 2) return true;

    // 192.168.0.0/16 (Private network Class C)
    if (p0 === 192 && p1 === 168) return true;

    // 198.18.0.0/15 (Network benchmark)
    if (p0 === 198 && (p1 === 18 || p1 === 19)) return true;

    // 198.51.100.0/24 (TEST-NET-2)
    if (p0 === 198 && p1 === 51 && parts[2] === 100) return true;

    // 203.0.113.0/24 (TEST-NET-3)
    if (p0 === 203 && p1 === 0 && parts[2] === 113) return true;

    // 224.0.0.0/4 (Multicast: 224.0.0.0 to 239.255.255.255)
    if (p0 >= 224 && p0 <= 239) return true;

    // 240.0.0.0/4 (Reserved for future use)
    if (p0 >= 240) return true;

    // 255.255.255.255 (Broadcast)
    if (ip === '255.255.255.255') return true;

    return false;
  }

  // IPv6 Checks
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();

    // Loopback ::1
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

    // Unspecified ::
    if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

    // IPv6 link-local fe80::/10
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
      return true;
    }

    // IPv6 unique local fc00::/7 (fc00:: and fd00::)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
      return true;
    }

    // IPv4-mapped IPv6 (::ffff:127.0.0.1, etc.)
    if (normalized.startsWith('::ffff:')) {
      const v4Part = normalized.replace('::ffff:', '');
      return isPrivateOrReservedIp(v4Part);
    }

    return false;
  }

  return true;
}

/**
 * Valide une URL pour ingestion de manière sécurisée contre les attaques SSRF
 */
export async function validateUrlForSsrf(rawUrl: string): Promise<SSRFValidationResult> {
  try {
    const parsed = new URL(rawUrl);

    // 1. Protocole : seuls HTTP et HTTPS sont autorisés
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        isSafe: false,
        reason: `Protocole interdit : ${parsed.protocol}. Seuls http: et https: sont acceptés.`,
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. Nom d'hôte interdit évident
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return {
        isSafe: false,
        reason: `Nom d'hôte privé ou local interdit : ${hostname}`,
      };
    }

    // 3. Si le hostname est directement une adresse IP
    if (net.isIP(hostname)) {
      if (isPrivateOrReservedIp(hostname)) {
        return {
          isSafe: false,
          reason: `Adresse IP privée ou réservée interdite : ${hostname}`,
          resolvedIp: hostname,
        };
      }
      return { isSafe: true, resolvedIp: hostname };
    }

    // 4. Résolution DNS stricte pour analyser les IPs associées
    const lookupResult = await dns.lookup(hostname, { all: true });

    if (!lookupResult || lookupResult.length === 0) {
      return {
        isSafe: false,
        reason: `Impossible de résoudre le domaine : ${hostname}`,
      };
    }

    for (const entry of lookupResult) {
      if (isPrivateOrReservedIp(entry.address)) {
        return {
          isSafe: false,
          reason: `Le domaine ${hostname} résout vers une IP privée ou interdite (${entry.address})`,
          resolvedIp: entry.address,
        };
      }
    }

    return {
      isSafe: true,
      resolvedIp: lookupResult[0].address,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      isSafe: false,
      reason: `Erreur d'analyse d'URL : ${errorMsg}`,
    };
  }
}

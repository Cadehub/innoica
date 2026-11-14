import { describe, it, expect } from 'vitest';
import { isPrivateOrReservedIp, validateUrlForSsrf } from '../security/ssrf.js';

describe('SSRF Protection Validator', () => {
  it('should detect private IPv4 ranges as unsafe', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIp('0.0.0.0')).toBe(true);
  });

  it('should allow public IPv4 addresses', () => {
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
    expect(isPrivateOrReservedIp('142.250.190.46')).toBe(false);
  });

  it('should detect private IPv6 addresses as unsafe', () => {
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
    expect(isPrivateOrReservedIp('fc00::1')).toBe(true);
  });

  it('should reject URLs with forbidden schemes like file: or ftp:', async () => {
    const resFile = await validateUrlForSsrf('file:///etc/passwd');
    expect(resFile.isSafe).toBe(false);

    const resFtp = await validateUrlForSsrf('ftp://example.com/test');
    expect(resFtp.isSafe).toBe(false);
  });

  it('should reject localhost or internal hostname URLs', async () => {
    const resLocalhost = await validateUrlForSsrf('http://localhost:3000/api');
    expect(resLocalhost.isSafe).toBe(false);

    const resInternal = await validateUrlForSsrf('http://server.internal/metrics');
    expect(resInternal.isSafe).toBe(false);
  });

  it('should reject cloud metadata endpoints', async () => {
    const resMeta = await validateUrlForSsrf('http://169.254.169.254/latest/meta-data/');
    expect(resMeta.isSafe).toBe(false);
  });

  it('should allow safe public HTTPS URLs', async () => {
    const resPublic = await validateUrlForSsrf('https://example.com');
    expect(resPublic.isSafe).toBe(true);
  });
});

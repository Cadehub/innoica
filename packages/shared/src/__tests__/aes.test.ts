import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, maskApiKey, getMasterEncryptionKey } from '../crypto/aes.js';

describe('AES-256-GCM Server-side Encryption', () => {
  const TEST_KEY = '4f9c2d1b8e7a3f0c6d5e4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e';
  const keyBuffer = getMasterEncryptionKey(TEST_KEY);

  it('should encrypt and decrypt a plaintext API key correctly', () => {
    const originalApiKey = 'sk-or-v1-abcdef1234567890abcdef1234567890';
    const encrypted = encryptSecret(originalApiKey, keyBuffer);

    expect(encrypted).not.toBe(originalApiKey);
    expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext

    const decrypted = decryptSecret(encrypted, keyBuffer);
    expect(decrypted).toBe(originalApiKey);
  });

  it('should generate different ciphertexts for the same plaintext due to random IV', () => {
    const text = 'my-secret-key-12345';
    const enc1 = encryptSecret(text, keyBuffer);
    const enc2 = encryptSecret(text, keyBuffer);

    expect(enc1).not.toBe(enc2);
    expect(decryptSecret(enc1, keyBuffer)).toBe(text);
    expect(decryptSecret(enc2, keyBuffer)).toBe(text);
  });

  it('should fail decryption if ciphertext or auth tag is tampered with', () => {
    const text = 'confidential-data';
    const encrypted = encryptSecret(text, keyBuffer);
    const parts = encrypted.split(':');

    // Tamper with ciphertext
    const tamperedCipher = parts[2].slice(0, -2) + (parts[2].endsWith('a') ? 'b' : 'a');
    const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

    expect(() => decryptSecret(tamperedPayload, keyBuffer)).toThrow();
  });

  it('should mask API keys properly for safe display', () => {
    expect(maskApiKey('sk-or-v1-1234567890abcdef')).toBe('sk-...cdef');
    expect(maskApiKey('gsk_abcdef1234567890')).toBe('...7890');
    expect(maskApiKey('short')).toBe('••••••••');
  });
});

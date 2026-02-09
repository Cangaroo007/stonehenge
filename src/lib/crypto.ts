/**
 * AES-256-GCM encryption utilities for secure OAuth token storage.
 *
 * Tokens are encrypted at rest in the database. The encryption key is derived
 * from the TOKEN_ENCRYPTION_KEY environment variable via PBKDF2, so a
 * human-readable passphrase is fine (though a full 64-hex-char key is better).
 *
 * Ciphertext format:  base64( iv(12) || ciphertext || authTag(16) )
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16; // 128-bit auth tag
const KEY_LENGTH = 32; // 256-bit key
const SALT = 'stonehenge-token-enc-v1'; // static salt (key is already high-entropy)

function getDerivedKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY environment variable is not set. ' +
        'Generate one with: openssl rand -hex 32'
    );
  }

  // If the key is already 64 hex chars (32 bytes), use it directly
  if (/^[0-9a-f]{64}$/i.test(secret)) {
    return Buffer.from(secret, 'hex');
  }

  // Otherwise derive a key via PBKDF2
  return crypto.pbkdf2Sync(secret, SALT, 100_000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a plaintext string (e.g. an OAuth access token).
 * Returns a base64 string suitable for database storage.
 */
export function encryptToken(plaintext: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Pack: iv || ciphertext || authTag
  const packed = Buffer.concat([iv, encrypted, authTag]);
  return packed.toString('base64');
}

/**
 * Decrypt a base64-encoded ciphertext back to the original plaintext string.
 */
export function decryptToken(ciphertext: string): string {
  const key = getDerivedKey();
  const packed = Buffer.from(ciphertext, 'base64');

  if (packed.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Invalid ciphertext: too short');
  }

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(packed.length - TAG_LENGTH);
  const encrypted = packed.subarray(IV_LENGTH, packed.length - TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

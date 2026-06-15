import { describe, it, expect, beforeEach } from 'vitest';
import {
  db,
  setSetting,
  getSetting,
  encrypt,
  decrypt
} from './sqlite_journal';

describe('SQLite Journal - User Settings', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM user_settings').run();
  });

  it('should set and get unencrypted setting', () => {
    setSetting('test_key', 'test_value');
    const value = getSetting('test_key');
    expect(value).toBe('test_value');
  });

  it('should set and get encrypted setting', () => {
    setSetting('secret_token', 'my_secret_token123', true);
    
    // Attempting to read it unencrypted should return the cipher text
    const encryptedRaw = getSetting('secret_token', false);
    expect(encryptedRaw).not.toBe('my_secret_token123');
    expect(encryptedRaw).toContain(':'); // IV format

    // Getting it encrypted should decrypt it properly
    const decrypted = getSetting('secret_token', true);
    expect(decrypted).toBe('my_secret_token123');
  });
  
  it('should correctly encrypt and decrypt raw text', () => {
    const plainText = 'The quick brown fox jumps over the lazy dog';
    const cipherText = encrypt(plainText);
    expect(cipherText).not.toBe(plainText);
    const resultText = decrypt(cipherText);
    expect(resultText).toBe(plainText);
  });
});

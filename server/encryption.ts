import CryptoJS from 'crypto-js';

let ENCRYPTION_KEY: string | undefined;

function getEncryptionKey(): string {
  if (!ENCRYPTION_KEY) {
    ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    if (!ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY environment variable is required. Please set it in your .env file.');
    }
  }
  return ENCRYPTION_KEY;
}

export class EncryptionService {
  private static get key() {
    return CryptoJS.enc.Utf8.parse(getEncryptionKey().padEnd(32, '0').slice(0, 32));
  }

  /**
   * Encrypt sensitive data
   */
  static encrypt(data: string): string {
    try {
      const encrypted = CryptoJS.AES.encrypt(data, this.key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      });
      return encrypted.toString();
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive data
   */
  static decrypt(encryptedData: string): string {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData, this.key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
      });
      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt an object's sensitive fields
   */
  static encryptObject<T extends Record<string, any>>(
    obj: T, 
    sensitiveFields: (keyof T)[]
  ): T {
    const encrypted = { ...obj };
    
    for (const field of sensitiveFields) {
      if (encrypted[field] && typeof encrypted[field] === 'string') {
        (encrypted as any)[field] = this.encrypt(encrypted[field] as string);
      }
    }
    
    return encrypted;
  }

  /**
   * Decrypt an object's sensitive fields
   */
  static decryptObject<T extends Record<string, any>>(
    obj: T, 
    sensitiveFields: (keyof T)[]
  ): T {
    const decrypted = { ...obj };
    
    for (const field of sensitiveFields) {
      if (decrypted[field] && typeof decrypted[field] === 'string') {
        try {
          (decrypted as any)[field] = this.decrypt(decrypted[field] as string);
        } catch (error) {
          // If decryption fails, the field might not be encrypted
          console.warn(`Failed to decrypt field ${String(field)}:`, error);
        }
      }
    }
    
    return decrypted;
  }

  /**
   * Check if a string is encrypted
   */
  static isEncrypted(data: string): boolean {
    try {
      // Try to decrypt - if it succeeds, it was encrypted
      this.decrypt(data);
      return true;
    } catch {
      // If decryption fails, it's not encrypted
      return false;
    }
  }

  /**
   * Hash data for comparison (one-way encryption)
   */
  static hash(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }

  /**
   * Generate a secure random key
   */
  static generateKey(): string {
    return CryptoJS.lib.WordArray.random(32).toString();
  }
} 
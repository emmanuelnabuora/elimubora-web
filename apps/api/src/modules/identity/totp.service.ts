import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

/**
 * TOTP (RFC 6238) for MFA. Secrets are stored encrypted with
 * AES-256-GCM (iv.ciphertext.tag, base64url) — a database leak must
 * not leak second factors alongside password hashes.
 */
@Injectable()
export class TotpService {
  private readonly key: Buffer;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.key = Buffer.from(config.auth.encKeyHex, 'hex');
    authenticator.options = { window: 1 };
  }

  generateSecret(): { secret: string; otpauthUrl: (email: string) => string } {
    const secret = authenticator.generateSecret(20);
    return {
      secret,
      otpauthUrl: (email: string) => authenticator.keyuri(email, 'ElimuBora', secret)
    };
  }

  check(code: string, secret: string): boolean {
    return authenticator.check(code, secret);
  }

  encrypt(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [iv, ct, cipher.getAuthTag()].map((b) => b.toString('base64url')).join('.');
  }

  decrypt(payload: string): string {
    const [ivB, ctB, tagB] = payload.split('.');
    if (!ivB || !ctB || !tagB) throw new Error('Malformed encrypted secret');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  }
}

import { authenticator } from 'otplib';
import type { AppConfig } from '../../config/configuration';
import { TotpService } from './totp.service';

const config: AppConfig = {
  nodeEnv: 'test',
  port: 0,
  databaseUrl: 'postgres://x:x@localhost/x',
  workerDatabaseUrl: 'postgres://x:x@localhost/x',
  outboxPollMs: 1000,
  syncVisibilityDelaySeconds: 0,
  publicWebUrl: 'http://localhost:3000',
  auth: {
    invitationTtlDays: 7,
    passwordResetTtlMinutes: 30,
    jwtSecret: 'a'.repeat(32),
    encKeyHex: '0123456789abcdef'.repeat(4),
    accessTtlSeconds: 900,
    refreshTtlDays: 30,
    allowOpenRegistration: false
  }
};

describe('TotpService', () => {
  const svc = new TotpService(config);

  it('encrypts secrets so ciphertext differs from plaintext and round-trips', () => {
    const { secret } = svc.generateSecret();
    const enc = svc.encrypt(secret);
    expect(enc).not.toContain(secret);
    expect(svc.decrypt(enc)).toBe(secret);
  });

  it('detects ciphertext tampering via the GCM auth tag', () => {
    const enc = svc.encrypt('SOMESECRET');
    const parts = enc.split('.');
    const flipped = Buffer.from(parts[1]!, 'base64url');
    flipped[0] = flipped[0]! ^ 0xff;
    parts[1] = flipped.toString('base64url');
    expect(() => svc.decrypt(parts.join('.'))).toThrow();
  });

  it('accepts a valid current TOTP code and rejects a wrong one', () => {
    const { secret } = svc.generateSecret();
    expect(svc.check(authenticator.generate(secret), secret)).toBe(true);
    expect(svc.check('000000', secret)).toBe(false);
  });
});

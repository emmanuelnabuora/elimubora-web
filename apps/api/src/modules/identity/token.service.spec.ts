import type { AppConfig } from '../../config/configuration';
import { TokenService } from './token.service';

const config = (secret = 'a'.repeat(32)): AppConfig => ({
  nodeEnv: 'test',
  port: 0,
  databaseUrl: 'postgres://x:x@localhost/x',
  workerDatabaseUrl: 'postgres://x:x@localhost/x',
  outboxPollMs: 1000,
  syncVisibilityDelaySeconds: 0,
  publicWebUrl: 'http://localhost:3000',
  uploadsDir: './uploads-test',
  auth: {
    invitationTtlDays: 7,
    passwordResetTtlMinutes: 30,
    jwtSecret: secret,
    encKeyHex: 'f'.repeat(64),
    accessTtlSeconds: 900,
    refreshTtlDays: 30,
    allowOpenRegistration: false
  }
});

describe('TokenService', () => {
  it('signs and verifies an access token with tenant claims', async () => {
    const svc = new TokenService(config());
    const token = await svc.signAccess({
      userId: 'u1',
      tenantId: 't1',
      role: 'teacher',
      sessionId: 's1'
    });
    const claims = await svc.verify(token, 'access');
    expect(claims).toMatchObject({ sub: 'u1', ten: 't1', rol: 'teacher', sid: 's1', typ: 'access' });
  });

  it('rejects tokens signed with a different secret', async () => {
    const token = await new TokenService(config('b'.repeat(32))).signAccess({
      userId: 'u1',
      tenantId: 't1',
      role: 'teacher',
      sessionId: 's1'
    });
    await expect(new TokenService(config()).verify(token, 'access')).rejects.toThrow();
  });

  it('refuses an MFA token where an access token is expected (no privilege smuggling)', async () => {
    const svc = new TokenService(config());
    const mfa = await svc.signMfaChallenge({ userId: 'u1', tenantId: 't1', role: 'teacher' });
    await expect(svc.verify(mfa, 'access')).rejects.toThrow(/Expected a access token/);
    await expect(svc.verify(mfa, 'mfa')).resolves.toMatchObject({ typ: 'mfa' });
  });

  it('generates opaque refresh tokens and stable hashes', () => {
    const svc = new TokenService(config());
    const a = svc.newRefreshToken();
    const b = svc.newRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).toBe(TokenService.hashRefreshToken(a.token));
    expect(a.hash).toHaveLength(64);
  });
});

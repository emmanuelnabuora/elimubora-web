import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { AppConfig } from '../../config/configuration';
import { AuthService } from './auth.service';
import type { IdentityRepository } from './identity.repository';
import type { MembershipRecord, UserRecord } from './identity.types';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';

const config: AppConfig = {
  nodeEnv: 'test',
  port: 0,
  databaseUrl: 'postgres://x:x@localhost/x',
  workerDatabaseUrl: 'postgres://x:x@localhost/x',
  outboxPollMs: 1000,
  syncVisibilityDelaySeconds: 0,
  publicWebUrl: 'http://localhost:3000',
  uploadsDir: './uploads-test',
  corsAllowedOrigins: ['http://localhost:3000'],
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

interface StoredToken {
  id: string;
  familyId: string;
  userId: string;
  tenantId: string;
  role: MembershipRecord['role'];
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** In-memory fake mirroring IdentityRepository's contract. */
class FakeRepo {
  user: UserRecord;
  memberships: MembershipRecord[];
  tokens: StoredToken[] = [];
  private seq = 0;

  constructor(user: UserRecord, memberships: MembershipRecord[]) {
    this.user = user;
    this.memberships = memberships;
  }

  async findUserByEmail(email: string) {
    return this.user.email === email ? { ...this.user } : null;
  }
  async findUserById(id: string) {
    return this.user.id === id ? { ...this.user } : null;
  }
  async listMembershipsForUser() {
    return this.memberships;
  }
  async recordLoginFailure(_: string, lockAfter: number) {
    this.user.failedAttempts += 1;
    if (this.user.failedAttempts >= lockAfter) {
      this.user.lockedUntil = new Date(Date.now() + 15 * 60_000);
    }
  }
  async recordLoginSuccess() {
    this.user.failedAttempts = 0;
    this.user.lockedUntil = null;
  }
  async setTotpSecret(_: string, enc: string) {
    this.user.totpSecretEnc = enc;
  }
  async enableTotp() {
    this.user.totpEnabled = true;
  }
  async createRefreshToken(input: Omit<StoredToken, 'id' | 'expiresAt' | 'revokedAt'> & { ttlDays: number }) {
    const id = `tok-${++this.seq}`;
    this.tokens.push({
      id,
      familyId: input.familyId,
      userId: input.userId,
      tenantId: input.tenantId,
      role: input.role,
      tokenHash: input.tokenHash,
      expiresAt: new Date(Date.now() + input.ttlDays * 86_400_000),
      revokedAt: null
    });
    return id;
  }
  async findRefreshToken(hash: string) {
    const t = this.tokens.find((x) => x.tokenHash === hash);
    return t ? { ...t } : null;
  }
  async rotateRefreshToken(oldId: string) {
    const t = this.tokens.find((x) => x.id === oldId);
    if (t) t.revokedAt = new Date();
  }
  async revokeFamily(familyId: string) {
    for (const t of this.tokens) {
      if (t.familyId === familyId && !t.revokedAt) t.revokedAt = new Date();
    }
  }
}

describe('AuthService', () => {
  const passwords = new PasswordService();
  const tokens = new TokenService(config);
  const totp = new TotpService(config);
  let repo: FakeRepo;
  let service: AuthService;

  const membership: MembershipRecord = {
    tenantId: 'ten-1',
    tenantSlug: 'moi-girls',
    tenantName: 'Moi Girls',
    role: 'teacher'
  };

  beforeEach(async () => {
    repo = new FakeRepo(
      {
        id: 'u1',
        email: 'amina@school.ke',
        fullName: 'Amina W.',
        passwordHash: await passwords.hash('Sound-Password-123'),
        status: 'active',
        failedAttempts: 0,
        lockedUntil: null,
        totpSecretEnc: null,
        totpEnabled: false
      },
      [membership]
    );
    service = new AuthService(
      config,
      repo as unknown as IdentityRepository,
      passwords,
      tokens,
      totp
    );
  });

  it('logs in with valid credentials and issues a verifiable access token', async () => {
    const result = await service.login({ email: 'amina@school.ke', password: 'Sound-Password-123' });
    if (result.kind !== 'authenticated') throw new Error('expected tokens');
    const claims = await tokens.verify(result.tokens.accessToken, 'access');
    expect(claims).toMatchObject({ sub: 'u1', ten: 'ten-1', rol: 'teacher' });
  });

  it('returns the same error for unknown email and wrong password (no enumeration)', async () => {
    const a = service.login({ email: 'ghost@school.ke', password: 'x' }).catch((e) => e);
    const b = service.login({ email: 'amina@school.ke', password: 'wrong' }).catch((e) => e);
    const [ea, eb] = await Promise.all([a, b]);
    expect(ea).toBeInstanceOf(UnauthorizedException);
    expect(eb).toBeInstanceOf(UnauthorizedException);
    expect((ea as Error).message).toBe((eb as Error).message);
  });

  it('locks the account after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i += 1) {
      await service.login({ email: 'amina@school.ke', password: 'wrong' }).catch(() => undefined);
    }
    await expect(
      service.login({ email: 'amina@school.ke', password: 'Sound-Password-123' })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rotates refresh tokens and the old token stops working', async () => {
    const login = await service.login({ email: 'amina@school.ke', password: 'Sound-Password-123' });
    if (login.kind !== 'authenticated') throw new Error('expected tokens');
    const first = login.tokens.refreshToken;

    const rotated = await service.refresh(first);
    expect(rotated.refreshToken).not.toBe(first);
    await expect(tokens.verify(rotated.accessToken, 'access')).resolves.toBeDefined();
  });

  it('detects reuse of a rotated token and revokes the entire family', async () => {
    const login = await service.login({ email: 'amina@school.ke', password: 'Sound-Password-123' });
    if (login.kind !== 'authenticated') throw new Error('expected tokens');
    const first = login.tokens.refreshToken;
    const second = (await service.refresh(first)).refreshToken;

    // Attacker replays the first (already rotated) token…
    await expect(service.refresh(first)).rejects.toBeInstanceOf(UnauthorizedException);
    // …and the legitimate holder's current token is dead too — family revoked.
    await expect(service.refresh(second)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.tokens.every((t) => t.revokedAt !== null)).toBe(true);
  });

  it('requires MFA when TOTP is enabled and completes via a valid code', async () => {
    await service.startTotpEnrollment('u1');
    const secret = totp.decrypt(repo.user.totpSecretEnc!);
    const { authenticator } = await import('otplib');
    await service.confirmTotpEnrollment('u1', authenticator.generate(secret));

    const login = await service.login({ email: 'amina@school.ke', password: 'Sound-Password-123' });
    if (login.kind !== 'mfa_required') throw new Error('expected MFA step-up');

    const tokensOut = await service.verifyMfa({
      mfaToken: login.mfaToken,
      code: authenticator.generate(secret)
    });
    const claims = await tokens.verify(tokensOut.accessToken, 'access');
    expect(claims.sub).toBe('u1');
  });

  it('rejects an MFA verification with a wrong code', async () => {
    await service.startTotpEnrollment('u1');
    const secret = totp.decrypt(repo.user.totpSecretEnc!);
    const { authenticator } = await import('otplib');
    await service.confirmTotpEnrollment('u1', authenticator.generate(secret));
    const login = await service.login({ email: 'amina@school.ke', password: 'Sound-Password-123' });
    if (login.kind !== 'mfa_required') throw new Error('expected MFA step-up');
    await expect(
      service.verifyMfa({ mfaToken: login.mfaToken, code: '000000' })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns select_institution with the REAL memberships list when a user belongs to more than one school — not an opaque error', async () => {
    const secondMembership: MembershipRecord = {
      tenantId: 'ten-2',
      tenantSlug: 'alliance-high',
      tenantName: 'Alliance High',
      role: 'principal'
    };
    repo.memberships = [membership, secondMembership];

    const result = await service.login({ email: 'amina@school.ke', password: 'Sound-Password-123' });
    if (result.kind !== 'select_institution') throw new Error('expected select_institution');
    expect(result.memberships).toEqual([membership, secondMembership]);

    // Once a tenantId is supplied, login proceeds normally against that institution.
    const resolved = await service.login({
      email: 'amina@school.ke',
      password: 'Sound-Password-123',
      tenantId: 'ten-2'
    });
    if (resolved.kind !== 'authenticated') throw new Error('expected tokens');
    const claims = await tokens.verify(resolved.tokens.accessToken, 'access');
    expect(claims).toMatchObject({ ten: 'ten-2', rol: 'principal' });
  });
});

describe('AuthService — mandatory MFA for platform_admin', () => {
  const passwords = new PasswordService();
  const tokens = new TokenService(config);
  const totp = new TotpService(config);
  let repo: FakeRepo;
  let service: AuthService;

  const adminMembership: MembershipRecord = {
    tenantId: 'ten-platform',
    tenantSlug: 'platform',
    tenantName: 'ElimuBora Platform',
    role: 'platform_admin'
  };

  beforeEach(async () => {
    repo = new FakeRepo(
      {
        id: 'admin-1',
        email: 'admin@elimubora.co',
        fullName: 'Platform Admin',
        passwordHash: await passwords.hash('Sound-Password-123'),
        status: 'active',
        failedAttempts: 0,
        lockedUntil: null,
        totpSecretEnc: null,
        totpEnabled: false
      },
      [adminMembership]
    );
    service = new AuthService(config, repo as unknown as IdentityRepository, passwords, tokens, totp);
  });

  it('never returns authenticated for a platform_admin without TOTP enabled', async () => {
    const result = await service.login({ email: 'admin@elimubora.co', password: 'Sound-Password-123' });
    expect(result.kind).toBe('mfa_setup_required');
  });

  it('completes forced enrollment end-to-end and receives a real session', async () => {
    const login = await service.login({ email: 'admin@elimubora.co', password: 'Sound-Password-123' });
    if (login.kind !== 'mfa_setup_required') throw new Error('expected mfa_setup_required');

    const { otpauthUrl } = await service.startForcedTotpEnrollment(login.mfaToken);
    expect(otpauthUrl).toContain('admin%40elimubora.co');

    const secret = totp.decrypt(repo.user.totpSecretEnc!);
    const { authenticator } = await import('otplib');
    const tokensOut = await service.confirmForcedTotpEnrollment(login.mfaToken, authenticator.generate(secret));

    const claims = await tokens.verify(tokensOut.accessToken, 'access');
    expect(claims).toMatchObject({ sub: 'admin-1', ten: 'ten-platform', rol: 'platform_admin' });
    expect(repo.user.totpEnabled).toBe(true);

    const nextLogin = await service.login({ email: 'admin@elimubora.co', password: 'Sound-Password-123' });
    expect(nextLogin.kind).toBe('mfa_required');
  });

  it('rejects a wrong code during forced enrollment confirmation', async () => {
    const login = await service.login({ email: 'admin@elimubora.co', password: 'Sound-Password-123' });
    if (login.kind !== 'mfa_setup_required') throw new Error('expected mfa_setup_required');
    await service.startForcedTotpEnrollment(login.mfaToken);
    await expect(
      service.confirmForcedTotpEnrollment(login.mfaToken, '000000')
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.user.totpEnabled).toBe(false);
  });

  it('refuses to re-enroll once TOTP is already enabled', async () => {
    const login = await service.login({ email: 'admin@elimubora.co', password: 'Sound-Password-123' });
    if (login.kind !== 'mfa_setup_required') throw new Error('expected mfa_setup_required');
    await service.startForcedTotpEnrollment(login.mfaToken);
    const secret = totp.decrypt(repo.user.totpSecretEnc!);
    const { authenticator } = await import('otplib');
    await service.confirmForcedTotpEnrollment(login.mfaToken, authenticator.generate(secret));

    await expect(service.startForcedTotpEnrollment(login.mfaToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.confirmForcedTotpEnrollment(login.mfaToken, authenticator.generate(secret))
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

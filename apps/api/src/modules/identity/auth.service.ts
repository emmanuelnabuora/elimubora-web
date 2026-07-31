import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { IdentityRepository } from './identity.repository';
import type { MembershipRecord, MembershipRole, UserRecord } from './identity.types';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';

const LOCK_AFTER_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export type LoginResult =
  | { kind: 'authenticated'; tokens: AuthTokens; memberships: MembershipRecord[] }
  | { kind: 'mfa_required'; mfaToken: string }
  | { kind: 'select_institution'; memberships: MembershipRecord[] };

/**
 * Authentication flows. Deliberate properties:
 * - Uniform "Invalid credentials" for unknown email / wrong password /
 *   suspended account: no user enumeration.
 * - Account lockout after 5 failures (15 min), persisted on the user
 *   row so it survives restarts and applies across replicas.
 * - Refresh rotation with reuse detection: presenting an already
 *   rotated token revokes the whole family. At-least-once theft
 *   response beats silent token replay.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly repo: IdentityRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly totp: TotpService
  ) {}

  async login(input: {
    email: string;
    password: string;
    tenantId?: string;
  }): Promise<LoginResult> {
    const user = await this.repo.findUserByEmail(input.email.trim().toLowerCase());
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new ForbiddenException('Account temporarily locked. Try again later.');
    }

    const valid = await this.passwords.verify(user.passwordHash, input.password);
    if (!valid) {
      await this.repo.recordLoginFailure(user.id, LOCK_AFTER_ATTEMPTS, LOCK_MINUTES);
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.repo.recordLoginSuccess(user.id);

    const memberships = await this.repo.listMembershipsForUser(user.id);
    if (memberships.length === 0) {
      throw new ForbiddenException('No active institution membership');
    }
    if (!input.tenantId && memberships.length > 1) {
      // The caller has more than one institution and hasn't picked
      // one yet. Returning the list (rather than throwing an opaque
      // error) is what lets the frontend render a real "which school"
      // picker — a plain error string gives it nothing to work with.
      return { kind: 'select_institution', memberships };
    }
    const membership = this.selectMembership(memberships, input.tenantId);

    if (user.totpEnabled) {
      const mfaToken = await this.tokens.signMfaChallenge({
        userId: user.id,
        tenantId: membership.tenantId,
        role: membership.role
      });
      return { kind: 'mfa_required', mfaToken };
    }

    const tokens = await this.issueSession(user.id, membership);
    return { kind: 'authenticated', tokens, memberships };
  }

  async verifyMfa(input: { mfaToken: string; code: string }): Promise<AuthTokens> {
    let claims;
    try {
      claims = await this.tokens.verify(input.mfaToken, 'mfa');
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA challenge');
    }
    const user = await this.repo.findUserById(claims.sub);
    if (!user?.totpEnabled || !user.totpSecretEnc) {
      throw new UnauthorizedException('MFA is not enabled for this account');
    }
    const secret = this.totp.decrypt(user.totpSecretEnc);
    if (!this.totp.check(input.code, secret)) {
      throw new UnauthorizedException('Invalid code');
    }
    return this.issueSession(user.id, { tenantId: claims.ten, role: claims.rol });
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const hash = TokenService.hashRefreshToken(refreshToken);
    const stored = await this.repo.findRefreshToken(hash);
    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (stored.revokedAt) {
      // Reuse of a rotated token — assume theft, kill the session family.
      await this.repo.revokeFamily(stored.familyId);
      this.logger.warn(
        `Refresh token reuse detected for user ${stored.userId}; family ${stored.familyId} revoked`
      );
      throw new UnauthorizedException('Session revoked');
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session expired');
    }

    const next = this.tokens.newRefreshToken();
    const newId = await this.repo.createRefreshToken({
      familyId: stored.familyId,
      userId: stored.userId,
      tenantId: stored.tenantId,
      role: stored.role,
      tokenHash: next.hash,
      ttlDays: this.config.auth.refreshTtlDays
    });
    await this.repo.rotateRefreshToken(stored.id, newId);

    const accessToken = await this.tokens.signAccess({
      userId: stored.userId,
      tenantId: stored.tenantId,
      role: stored.role,
      sessionId: stored.familyId
    });
    return {
      accessToken,
      refreshToken: next.token,
      expiresInSeconds: this.config.auth.accessTtlSeconds
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.repo.findRefreshToken(TokenService.hashRefreshToken(refreshToken));
    if (stored) await this.repo.revokeFamily(stored.familyId);
  }

  async startTotpEnrollment(userId: string): Promise<{ otpauthUrl: string }> {
    const user = await this.requireUser(userId);
    const { secret, otpauthUrl } = this.totp.generateSecret();
    await this.repo.setTotpSecret(user.id, this.totp.encrypt(secret));
    return { otpauthUrl: otpauthUrl(user.email) };
  }

  async confirmTotpEnrollment(userId: string, code: string): Promise<void> {
    const user = await this.requireUser(userId);
    if (!user.totpSecretEnc) {
      throw new UnauthorizedException('No enrollment in progress');
    }
    if (!this.totp.check(code, this.totp.decrypt(user.totpSecretEnc))) {
      throw new UnauthorizedException('Invalid code');
    }
    await this.repo.enableTotp(user.id);
  }

  private async issueSession(
    userId: string,
    membership: Pick<MembershipRecord, 'tenantId' | 'role'>
  ): Promise<AuthTokens> {
    const familyId = randomUUID();
    const refresh = this.tokens.newRefreshToken();
    await this.repo.createRefreshToken({
      familyId,
      userId,
      tenantId: membership.tenantId,
      role: membership.role,
      tokenHash: refresh.hash,
      ttlDays: this.config.auth.refreshTtlDays
    });
    const accessToken = await this.tokens.signAccess({
      userId,
      tenantId: membership.tenantId,
      role: membership.role,
      sessionId: familyId
    });
    return {
      accessToken,
      refreshToken: refresh.token,
      expiresInSeconds: this.config.auth.accessTtlSeconds
    };
  }

  private selectMembership(
    memberships: MembershipRecord[],
    tenantId: string | undefined
  ): MembershipRecord {
    if (memberships.length === 0) {
      throw new ForbiddenException('No active institution membership');
    }
    if (tenantId) {
      const match = memberships.find((m) => m.tenantId === tenantId);
      if (!match) throw new ForbiddenException('Not a member of the requested institution');
      return match;
    }
    if (memberships.length > 1) {
      throw new ForbiddenException(
        'Multiple institutions found — specify tenantId in the login request'
      );
    }
    return memberships[0]!;
  }

  private async requireUser(userId: string): Promise<UserRecord> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new UnauthorizedException('Unknown user');
    return user;
  }
}

export type { MembershipRole };

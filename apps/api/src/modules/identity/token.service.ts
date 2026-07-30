import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import type { AccessTokenClaims, MembershipRole } from './identity.types';

const ISSUER = 'elimubora';
const AUDIENCE = 'elimubora-api';

/**
 * Access tokens: short-lived HS256 JWTs (claims: sub, ten, rol, sid, typ).
 * MFA tokens: same signature, typ='mfa', 5-minute lifetime — they prove
 * password possession while a TOTP code is awaited and grant no API access.
 * Refresh tokens: opaque 256-bit random values; only their SHA-256 hash
 * is ever stored or compared.
 */
@Injectable()
export class TokenService {
  private readonly key: Uint8Array;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.key = new TextEncoder().encode(config.auth.jwtSecret);
  }

  signAccess(input: {
    userId: string;
    tenantId: string;
    role: MembershipRole;
    sessionId: string;
  }): Promise<string> {
    return new SignJWT({ ten: input.tenantId, rol: input.role, sid: input.sessionId, typ: 'access' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(input.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.config.auth.accessTtlSeconds}s`)
      .sign(this.key);
  }

  signMfaChallenge(input: { userId: string; tenantId: string; role: MembershipRole }): Promise<string> {
    return new SignJWT({ ten: input.tenantId, rol: input.role, sid: 'mfa', typ: 'mfa' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(input.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(this.key);
  }

  async verify(token: string, expectedType: 'access' | 'mfa'): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.key, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256']
    });
    if (payload.typ !== expectedType || typeof payload.sub !== 'string') {
      throw new Error(`Expected a ${expectedType} token`);
    }
    return payload as unknown as AccessTokenClaims;
  }

  newRefreshToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: TokenService.hashRefreshToken(token) };
  }

  static hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

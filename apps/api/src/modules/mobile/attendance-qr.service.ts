import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';

const ISSUER = 'elimubora';
const AUDIENCE = 'elimubora-attendance-qr';
/** Short-lived by design — a QR code may be visible to a camera/screen
 *  for a while; a session token that outlives the lesson is a liability. */
const SESSION_TTL_MINUTES = 15;

export interface AttendanceSessionClaims {
  classStreamId: string;
  attendanceDate: string;
}

/**
 * Signs and verifies the QR payload a teacher's device displays for
 * an attendance session. Deliberately NOT built on identity's
 * TokenService — modules/mobile cannot import modules/identity
 * (module boundary). jose is a general-purpose library, not a
 * project service, so using it directly here is the same relationship
 * every module has with any third-party npm package, not a boundary
 * exception.
 */
@Injectable()
export class AttendanceQrService {
  private readonly key: Uint8Array;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.key = new TextEncoder().encode(config.auth.jwtSecret);
  }

  async signSession(claims: AttendanceSessionClaims): Promise<string> {
    return new SignJWT({ csi: claims.classStreamId, dat: claims.attendanceDate })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_TTL_MINUTES}m`)
      .sign(this.key);
  }

  async verifySession(token: string): Promise<AttendanceSessionClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256']
      });
      return {
        classStreamId: payload.csi as string,
        attendanceDate: payload.dat as string
      };
    } catch {
      throw new UnauthorizedException('This attendance code has expired or is invalid');
    }
  }
}

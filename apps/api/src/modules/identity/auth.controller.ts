import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Post
} from '@nestjs/common';
import { Throttle, minutes } from '@nestjs/throttler';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { CurrentUser, Public } from './auth.decorators';
import {
  loginSchema,
  mfaSetupConfirmSchema,
  mfaSetupEnrollSchema,
  mfaVerifySchema,
  refreshSchema,
  registerSchema,
  totpConfirmSchema,
  type LoginDto,
  type MfaSetupConfirmDto,
  type MfaSetupEnrollDto,
  type MfaVerifyDto,
  type RefreshDto,
  type RegisterDto,
  type TotpConfirmDto
} from './auth.dto';
import { AuthService } from './auth.service';
import { UsersService } from './users.service';
import {
  acceptInvitationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  type AcceptInvitationDto,
  type ForgotPasswordDto,
  type ResetPasswordDto
} from './users.dto';
import { IdentityRepository } from './identity.repository';
import type { AuthenticatedUser } from './identity.types';
import { PasswordService } from './password.service';
import { ZodValidationPipe } from './zod-validation.pipe';

// Login, MFA, password reset, and registration are the classic
// brute-force/enumeration targets — 5/minute is tight enough to stop
// automated guessing while still allowing a real user who mistypes a
// password a couple of times. Every other endpoint uses CoreModule's
// much looser 'default' throttler (100/minute) instead.
const STRICT_AUTH_THROTTLE = { default: { limit: 5, ttl: minutes(1) } };

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly repo: IdentityRepository,
    private readonly passwords: PasswordService
  ) {}

  @Public()
  @Throttle(STRICT_AUTH_THROTTLE)
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Throttle(STRICT_AUTH_THROTTLE)
  @Post('mfa/verify')
  @HttpCode(200)
  verifyMfa(@Body(new ZodValidationPipe(mfaVerifySchema)) dto: MfaVerifyDto) {
    return this.auth.verifyMfa(dto);
  }

  // Mandatory-setup counterparts for a platform_admin who hasn't
  // enrolled in TOTP yet — see AuthService.login's mfa_setup_required
  // branch. @Public() because there's no session yet by design; the
  // mfaToken in the body is what proves password possession instead.
  @Public()
  @Throttle(STRICT_AUTH_THROTTLE)
  @Post('mfa/setup/enroll')
  @HttpCode(200)
  startMfaSetup(@Body(new ZodValidationPipe(mfaSetupEnrollSchema)) dto: MfaSetupEnrollDto) {
    return this.auth.startForcedTotpEnrollment(dto.mfaToken);
  }

  @Public()
  @Throttle(STRICT_AUTH_THROTTLE)
  @Post('mfa/setup/confirm')
  @HttpCode(200)
  confirmMfaSetup(@Body(new ZodValidationPipe(mfaSetupConfirmSchema)) dto: MfaSetupConfirmDto) {
    return this.auth.confirmForcedTotpEnrollment(dto.mfaToken, dto.code);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodValidationPipe(refreshSchema)) dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const record = await this.repo.findUserById(user.userId);
    const memberships = await this.repo.listMembershipsForUser(user.userId);
    return {
      id: user.userId,
      email: record?.email,
      fullName: record?.fullName,
      totpEnabled: record?.totpEnabled ?? false,
      activeTenantId: user.tenantId,
      role: user.role,
      memberships
    };
  }

  @Post('totp/enroll')
  startTotp(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.startTotpEnrollment(user.userId);
  }

  @Post('totp/confirm')
  @HttpCode(204)
  async confirmTotp(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(totpConfirmSchema)) dto: TotpConfirmDto
  ): Promise<void> {
    await this.auth.confirmTotpEnrollment(user.userId, dto.code);
  }

  @Public()
  @Post('invitations/accept')
  acceptInvitation(@Body(new ZodValidationPipe(acceptInvitationSchema)) dto: AcceptInvitationDto) {
    return this.users.acceptInvitation(dto);
  }

  @Public()
  @Throttle(STRICT_AUTH_THROTTLE)
  @Post('password/forgot')
  @HttpCode(204)
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) dto: ForgotPasswordDto
  ): Promise<void> {
    await this.users.requestPasswordReset(dto.email);
  }

  @Public()
  @Throttle(STRICT_AUTH_THROTTLE)
  @Post('password/reset')
  @HttpCode(204)
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordDto
  ): Promise<void> {
    await this.users.resetPassword(dto.token, dto.newPassword);
  }

  /**
   * Development bootstrap only (ALLOW_OPEN_REGISTRATION). Production
   * onboarding is invitation-based and ships with Sprint 3 (User
   * Management); the config loader refuses this flag in production.
   */
  @Public()
  @Throttle(STRICT_AUTH_THROTTLE)
  @Post('register')
  async register(@Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto) {
    if (!this.config.auth.allowOpenRegistration) {
      throw new ForbiddenException('Open registration is disabled');
    }
    const userId = await this.repo.createUserWithMembership({
      email: dto.email.trim().toLowerCase(),
      fullName: dto.fullName,
      passwordHash: await this.passwords.hash(dto.password),
      tenantId: dto.tenantId,
      role: dto.role
    });
    return { id: userId };
  }
}

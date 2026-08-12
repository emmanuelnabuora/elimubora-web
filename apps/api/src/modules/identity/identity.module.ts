import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IdentityRepository } from './identity.repository';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

/**
 * Identity & Access Management (Module 1 — Sprint 2 scope).
 * Registers the global authentication and role guards: every route in
 * every future module is authenticated by default; opting out requires
 * an explicit @Public() decorator. PasswordService is provided globally
 * by CoreModule (Sprint 5), not registered here.
 */
@Module({
  controllers: [AuthController, UsersController],
  providers: [
    AuthService,
    IdentityRepository,
    UsersRepository,
    UsersService,
    TokenService,
    TotpService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard }
  ],
  exports: [TokenService, UsersService]
})
export class IdentityModule {}


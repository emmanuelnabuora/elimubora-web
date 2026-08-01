import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AppConfig } from '../../config/configuration';
import type { NotificationMessage } from '../../core/notifications/notification';
import type { IdentityRepository } from './identity.repository';
import { PasswordService } from './password.service';
import { UsersService } from './users.service';
import type { UsersRepository } from './users.repository';

const config: AppConfig = {
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
    jwtSecret: 'a'.repeat(32),
    encKeyHex: '0123456789abcdef'.repeat(4),
    accessTtlSeconds: 900,
    refreshTtlDays: 30,
    allowOpenRegistration: false
  }
};

describe('UsersService', () => {
  const delivered: NotificationMessage[] = [];
  const notifications = { deliver: jest.fn(async (m: NotificationMessage) => void delivered.push(m)) };

  const usersRepo = {
    createInvitation: jest.fn(async (_input: { tokenHash: string; email: string }) => 'inv-1'),
    updateMembership: jest.fn(async () => true),
    softDeleteMembership: jest.fn(async () => true),
    createPasswordReset: jest.fn(async () => undefined),
    consumePasswordReset: jest.fn(async () => null as string | null)
  };
  const identityRepo = {
    findUserByEmail: jest.fn(async () => null as unknown),
    revokeAllForUser: jest.fn(async () => undefined),
    setPassword: jest.fn(async () => undefined)
  };

  const service = new UsersService(
    config,
    notifications,
    usersRepo as unknown as UsersRepository,
    identityRepo as unknown as IdentityRepository,
    new PasswordService()
  );

  beforeEach(() => {
    delivered.length = 0;
    jest.clearAllMocks();
  });

  it('stores only a hash of the invitation token; the raw token goes to the channel', async () => {
    const res = await service.createInvitation({
      email: 'New.Teacher@School.KE',
      role: 'teacher',
      invitedBy: 'admin-1'
    });
    const stored = usersRepo.createInvitation.mock.calls[0]![0];
    const sentUrl = (delivered[0]!.data as { acceptUrl: string }).acceptUrl;
    const rawToken = new URL(sentUrl).searchParams.get('token')!;

    expect(stored.email).toBe('new.teacher@school.ke');
    expect(stored.tokenHash).toHaveLength(64);
    expect(stored.tokenHash).not.toBe(rawToken);
    expect(sentUrl).not.toContain(stored.tokenHash);
    // Outside production the URL is echoed for local development.
    expect(res.acceptUrl).toBe(sentUrl);
  });

  it('refuses to let an admin modify or remove their own membership', async () => {
    await expect(
      service.updateMembership('admin-1', 'admin-1', { status: 'suspended' })
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.removeMembership('admin-1', 'admin-1')).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(usersRepo.updateMembership).not.toHaveBeenCalled();
    expect(usersRepo.softDeleteMembership).not.toHaveBeenCalled();
  });

  it('revokes all sessions when a membership is suspended or removed', async () => {
    await service.updateMembership('admin-1', 'user-2', { status: 'suspended' });
    await service.removeMembership('admin-1', 'user-3');
    expect(identityRepo.revokeAllForUser).toHaveBeenCalledWith('user-2');
    expect(identityRepo.revokeAllForUser).toHaveBeenCalledWith('user-3');
  });

  it('password reset request is uniform for unknown accounts (no enumeration)', async () => {
    await expect(service.requestPasswordReset('ghost@school.ke')).resolves.toBeUndefined();
    expect(usersRepo.createPasswordReset).not.toHaveBeenCalled();
    expect(notifications.deliver).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired reset token without touching the password', async () => {
    usersRepo.consumePasswordReset.mockResolvedValueOnce(null);
    await expect(service.resetPassword('bad-token-bad-token-bad', 'new-password-long')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(identityRepo.setPassword).not.toHaveBeenCalled();
  });

  it('a successful reset sets the password and revokes every session', async () => {
    usersRepo.consumePasswordReset.mockResolvedValueOnce('user-9');
    await service.resetPassword('good-token-good-token-1', 'new-password-long');
    expect(identityRepo.setPassword).toHaveBeenCalledWith('user-9', expect.stringContaining('$argon2id$'));
    expect(identityRepo.revokeAllForUser).toHaveBeenCalledWith('user-9');
  });
});

import { requestRestoreSchema } from './platform-command.dto';
import { PlatformCommandService } from './platform-command.service';

describe('PlatformCommandService', () => {
  it('rejects a missing restore reason at the validation layer', () => {
    const result = requestRestoreSchema.safeParse({
      backupSnapshotId: '11111111-1111-1111-1111-111111111111',
      environment: 'production',
      reason: ''
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid restore environments at the validation layer', () => {
    const result = requestRestoreSchema.safeParse({
      backupSnapshotId: '11111111-1111-1111-1111-111111111111',
      environment: 'not-a-real-environment',
      reason: 'Recovering from data corruption incident INC-1234'
    });
    expect(result.success).toBe(false);
  });

  it('approveRestore refuses to let the requester approve their own restore request', async () => {
    // The maker-checker guard lives in the SQL WHERE clause
    // (requested_by <> $2), so this exercises it directly rather than
    // mocking around it -- if a caller could approve their own
    // restore request, the entire two-step "request then approve"
    // workflow for a production database restore would just be one
    // person clicking twice.
    const repo = { query: jest.fn().mockResolvedValue([]) } as any;
    const service = new PlatformCommandService(repo);
    await expect(service.approveRestore({ userId: 'same-admin' } as never, 'restore-id')).rejects.toThrow(
      'you are the same person who requested it'
    );
    const [sql, params] = repo.query.mock.calls[0];
    expect(sql).toContain('requested_by <> $2');
    expect(params).toEqual(['restore-id', 'same-admin']);
  });

  it('does not expose raw cloud destruction methods', () => {
    // Deliberate safety boundary: this service tracks and gates
    // incident/restore/deployment *workflows* -- it never gained the
    // ability to actually delete infrastructure or run arbitrary
    // commands, and this test exists to catch it immediately if that
    // ever changes.
    const methods = Object.getOwnPropertyNames(PlatformCommandService.prototype);
    expect(methods).not.toContain('deleteDatabase');
    expect(methods).not.toContain('deleteCloudRunService');
    expect(methods).not.toContain('runShellCommand');
  });
});

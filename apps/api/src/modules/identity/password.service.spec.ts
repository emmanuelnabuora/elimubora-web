import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with argon2id and verifies round-trip', async () => {
    const hash = await service.hash('Correct-Horse-Battery-1');
    expect(hash).toContain('$argon2id$');
    expect(hash).not.toContain('Correct-Horse');
    await expect(service.verify(hash, 'Correct-Horse-Battery-1')).resolves.toBe(true);
    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('treats a malformed stored hash as a failed verification, not a crash', async () => {
    await expect(service.verify('not-a-hash', 'anything')).resolves.toBe(false);
  });
});

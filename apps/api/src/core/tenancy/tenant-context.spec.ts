import { TenantContext } from './tenant-context';

describe('TenantContext', () => {
  it('exposes the context inside run() and nothing outside it', () => {
    expect(TenantContext.current()).toBeUndefined();
    TenantContext.run({ requestId: 'r1', tenantId: 't1' }, () => {
      expect(TenantContext.current()).toEqual({ requestId: 'r1', tenantId: 't1' });
    });
    expect(TenantContext.current()).toBeUndefined();
  });

  it('isolates concurrent async flows', async () => {
    const seen: Array<string | undefined> = [];
    await Promise.all(
      ['a', 'b', 'c'].map((id) =>
        TenantContext.run({ requestId: id, tenantId: id }, async () => {
          await new Promise((r) => setTimeout(r, Math.random() * 20));
          seen.push(TenantContext.current()?.tenantId);
          expect(TenantContext.current()?.tenantId).toBe(id);
        })
      )
    );
    expect(seen.sort()).toEqual(['a', 'b', 'c']);
  });

  it('requireTenantId throws when no tenant is bound', () => {
    expect(() => TenantContext.requireTenantId()).toThrow(/No tenant bound/);
    TenantContext.run({ requestId: 'r', tenantId: 't9' }, () => {
      expect(TenantContext.requireTenantId()).toBe('t9');
    });
  });
});

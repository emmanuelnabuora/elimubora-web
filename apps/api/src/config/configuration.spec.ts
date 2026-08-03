import { loadConfig } from './configuration';

const baseEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://elimubora_app:secret@localhost:5432/elimubora',
  AUTH_JWT_SECRET: 'a'.repeat(32),
  AUTH_ENC_KEY: '0123456789abcdef'.repeat(4)
};

describe('loadConfig', () => {
  it('accepts a normal localhost connection string', () => {
    expect(() => loadConfig(baseEnv)).not.toThrow();
  });

  it(
    'accepts Cloud SQL\u2019s Unix-socket connection string format ' +
      '(no host between @ and /, the actual socket path lives in ?host=) ' +
      '\u2014 found via a real Cloud Run deployment failure, not hypothetical',
    () => {
      const env = {
        ...baseEnv,
        DATABASE_URL:
          'postgres://elimubora_app:secret@/elimubora?host=/cloudsql/proj:region:instance',
        WORKER_DATABASE_URL:
          'postgres://elimubora_worker:secret@/elimubora?host=/cloudsql/proj:region:instance'
      };
      expect(() => loadConfig(env)).not.toThrow();
    }
  );

  it('still rejects genuinely garbled input, not just anything', () => {
    expect(() => loadConfig({ ...baseEnv, DATABASE_URL: 'not-a-connection-string' })).toThrow(
      /Invalid environment configuration/
    );
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _unused, ...rest } = baseEnv;
    expect(() => loadConfig(rest)).toThrow(/Invalid environment configuration/);
  });
});

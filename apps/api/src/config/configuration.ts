import { z } from 'zod';

/**
 * Environment configuration, validated at startup with Zod.
 * The process refuses to boot with an invalid configuration —
 * misconfiguration must fail loudly, not at first request.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  WORKER_DATABASE_URL: z.string().url().optional(),
  OUTBOX_POLL_MS: z.coerce.number().int().min(100).default(1000),
  /** See ADR-007: bounds the out-of-order commit window of core.change_log's
   *  global sequence. Lower in tests where writes and pulls happen milliseconds
   *  apart; production default balances safety against sync latency. */
  SYNC_VISIBILITY_DELAY_SECONDS: z.coerce.number().min(0).default(2),
  /** HS256 signing secret for access/MFA tokens. Rotated via secrets manager. */
  AUTH_JWT_SECRET: z.string().min(32),
  /** 64 hex chars (32 bytes) — AES-256-GCM key for TOTP secret encryption. */
  AUTH_ENC_KEY: z.string().regex(/^[0-9a-f]{64}$/i),
  AUTH_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  AUTH_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:3000'),
  INVITATION_TTL_DAYS: z.coerce.number().int().min(1).default(7),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().min(5).default(30),
  /** Open self-registration is a development convenience only. */
  ALLOW_OPEN_REGISTRATION: z
    .string()
    .transform((v) => v === 'true')
    .default('false')
});

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  workerDatabaseUrl: string;
  outboxPollMs: number;
  syncVisibilityDelaySeconds: number;
  publicWebUrl: string;
  auth: {
    invitationTtlDays: number;
    passwordResetTtlMinutes: number;
    jwtSecret: string;
    encKeyHex: string;
    accessTtlSeconds: number;
    refreshTtlDays: number;
    allowOpenRegistration: boolean;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration — ${issues}`);
  }
  const v = parsed.data;
  if (v.NODE_ENV === 'production' && v.ALLOW_OPEN_REGISTRATION) {
    throw new Error('ALLOW_OPEN_REGISTRATION must not be enabled in production');
  }
  return {
    nodeEnv: v.NODE_ENV,
    port: v.PORT,
    databaseUrl: v.DATABASE_URL,
    workerDatabaseUrl: v.WORKER_DATABASE_URL ?? v.DATABASE_URL,
    outboxPollMs: v.OUTBOX_POLL_MS,
    syncVisibilityDelaySeconds: v.SYNC_VISIBILITY_DELAY_SECONDS,
    publicWebUrl: v.PUBLIC_WEB_URL,
    auth: {
      invitationTtlDays: v.INVITATION_TTL_DAYS,
      passwordResetTtlMinutes: v.PASSWORD_RESET_TTL_MINUTES,
      jwtSecret: v.AUTH_JWT_SECRET,
      encKeyHex: v.AUTH_ENC_KEY,
      accessTtlSeconds: v.AUTH_ACCESS_TTL_SECONDS,
      refreshTtlDays: v.AUTH_REFRESH_TTL_DAYS,
      allowOpenRegistration: v.ALLOW_OPEN_REGISTRATION
    }
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');

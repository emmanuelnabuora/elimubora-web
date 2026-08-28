import { z } from 'zod';
import { MEMBERSHIP_ROLES } from './identity.types';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantId: z.string().uuid().optional()
});
export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(20) });
export type RefreshDto = z.infer<typeof refreshSchema>;

export const mfaVerifySchema = z.object({
  mfaToken: z.string().min(20),
  code: z.string().regex(/^\d{6}$/)
});
export type MfaVerifyDto = z.infer<typeof mfaVerifySchema>;

export const totpConfirmSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
export type TotpConfirmDto = z.infer<typeof totpConfirmSchema>;

export const mfaSetupEnrollSchema = z.object({ mfaToken: z.string().min(20) });
export type MfaSetupEnrollDto = z.infer<typeof mfaSetupEnrollSchema>;

export const mfaSetupConfirmSchema = z.object({
  mfaToken: z.string().min(20),
  code: z.string().regex(/^\d{6}$/)
});
export type MfaSetupConfirmDto = z.infer<typeof mfaSetupConfirmSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(200),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(200),
  tenantId: z.string().uuid(),
  role: z.enum(MEMBERSHIP_ROLES)
});
export type RegisterDto = z.infer<typeof registerSchema>;

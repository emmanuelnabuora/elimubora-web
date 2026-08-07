import { z } from 'zod';
import { MEMBERSHIP_ROLES } from './identity.types';

export const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(MEMBERSHIP_ROLES)
});
export type CreateInvitationDto = z.infer<typeof createInvitationSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(20),
  fullName: z.string().min(2).max(200).optional(),
  password: z.string().min(12).max(200).optional()
});
export type AcceptInvitationDto = z.infer<typeof acceptInvitationSchema>;

export const updateMembershipSchema = z
  .object({
    role: z.enum(MEMBERSHIP_ROLES).optional(),
    status: z.enum(['active', 'suspended']).optional()
  })
  .refine((v) => v.role !== undefined || v.status !== undefined, {
    message: 'Provide role and/or status'
  });
export type UpdateMembershipDto = z.infer<typeof updateMembershipSchema>;

export const updateFullNameSchema = z.object({
  fullName: z.string().min(2).max(200)
});
export type UpdateFullNameDto = z.infer<typeof updateFullNameSchema>;

export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});
export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>;

export const forgotPasswordSchema = z.object({ email: z.string().email() });
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(12).max(200)
});
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

import { z } from 'zod';

const permissionKeys = [
  'view_academics',
  'view_attendance',
  'receive_announcements',
  'view_finance',
  'pay_fees',
  'authorize_student_changes'
] as const;

export const guardianPermissionsSchema = z.object(
  Object.fromEntries(permissionKeys.map((k) => [k, z.boolean()])) as Record<(typeof permissionKeys)[number], z.ZodBoolean>
).partial();

export const createGuardianInvitationSchema = z.object({
  email: z.string().email(),
  relationship: z.string().trim().min(1).max(80),
  isPrimary: z.boolean().default(false),
  canPickup: z.boolean().default(true),
  isEmergencyContact: z.boolean().default(false),
  permissions: guardianPermissionsSchema.default({})
});
export type CreateGuardianInvitationDto = z.infer<typeof createGuardianInvitationSchema>;

export const declineInvitationSchema = z.object({
  token: z.string().min(1)
});
export type DeclineInvitationDto = z.infer<typeof declineInvitationSchema>;

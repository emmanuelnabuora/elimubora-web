import { z } from 'zod';

export const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  kind: z.string().trim().max(40).optional(),
  countyCode: z.string().trim().max(8).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0)
});
export type ListQueryDto = z.infer<typeof listQuerySchema>;

export const institutionStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'archived']),
  reason: z.string().trim().min(5).max(500)
});
export type InstitutionStatusDto = z.infer<typeof institutionStatusSchema>;

export const acknowledgeAlertSchema = z.object({
  note: z.string().trim().min(3).max(1000).optional()
});
export type AcknowledgeAlertDto = z.infer<typeof acknowledgeAlertSchema>;

export const supportStatusSchema = z.object({
  status: z.enum(['new', 'assigned', 'waiting', 'escalated', 'resolved', 'closed']),
  note: z.string().trim().max(1000).optional()
});
export type SupportStatusDto = z.infer<typeof supportStatusSchema>;

export const featureFlagSchema = z.object({
  enabled: z.boolean(),
  rolloutPercentage: z.number().int().min(0).max(100).default(100),
  reason: z.string().trim().min(5).max(500)
});
export type FeatureFlagDto = z.infer<typeof featureFlagSchema>;

/**
 * Soft delete only -- see platform-admin.repository.ts deleteInstitution
 * for why a real DELETE FROM core.tenants is not on the table at all
 * (49 tables reference it by foreign key, almost none with ON DELETE
 * CASCADE). confirmName exists purely as friction: typing the exact
 * tenant name is the same "type to confirm" pattern used for
 * destructive actions elsewhere, and it's checked server-side, not
 * just disabling a button client-side.
 */
export const deleteTenantSchema = z.object({
  confirmName: z.string().trim().min(1),
  reason: z.string().trim().min(5).max(500)
});
export type DeleteTenantDto = z.infer<typeof deleteTenantSchema>;

export const deleteUserSchema = z.object({
  reason: z.string().trim().min(5).max(500)
});
export type DeleteUserDto = z.infer<typeof deleteUserSchema>;

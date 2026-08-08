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

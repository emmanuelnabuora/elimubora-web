import { z } from 'zod';

export const updateModelSchema = z.object({
  status: z.enum(['disabled', 'sandbox', 'approved', 'restricted', 'retired']),
  active: z.boolean().default(false)
});
export type UpdateModelDto = z.infer<typeof updateModelSchema>;

export const updatePolicySchema = z.object({
  enabled: z.boolean(),
  rules: z.record(z.unknown()).default({})
});
export type UpdatePolicyDto = z.infer<typeof updatePolicySchema>;

export const resolveReviewSchema = z.object({
  status: z.enum(['resolved', 'dismissed'])
});
export type ResolveReviewDto = z.infer<typeof resolveReviewSchema>;

export const requestExportSchema = z.object({
  exportType: z.string().trim().min(1).max(120),
  format: z.enum(['csv', 'json', 'xlsx', 'parquet']).default('csv'),
  institutionId: z.string().uuid().nullable().optional(),
  filterSpec: z.record(z.unknown()).default({})
});
export type RequestExportDto = z.infer<typeof requestExportSchema>;

export const updateRetentionSchema = z.object({
  retentionDays: z.number().int().positive(),
  archiveAfterDays: z.number().int().positive().nullable().optional(),
  legalHold: z.boolean().default(false)
});
export type UpdateRetentionDto = z.infer<typeof updateRetentionSchema>;

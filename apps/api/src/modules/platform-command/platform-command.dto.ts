import { z } from 'zod';

export const createIncidentSchema = z.object({
  title: z.string().trim().min(3).max(300),
  severity: z.enum(['sev1', 'sev2', 'sev3', 'sev4']),
  affectedServices: z.array(z.string()).default([]),
  summary: z.string().trim().max(2000).nullable().optional(),
  customerImpact: z.string().trim().max(2000).nullable().optional()
});
export type CreateIncidentDto = z.infer<typeof createIncidentSchema>;

export const updateIncidentSchema = z.object({
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved', 'closed']),
  rootCause: z.string().trim().max(2000).nullable().optional()
});
export type UpdateIncidentDto = z.infer<typeof updateIncidentSchema>;

export const createComplianceRequestSchema = z.object({
  requestType: z.enum(['access', 'correction', 'deletion', 'restriction', 'objection', 'portability', 'breach', 'legal_hold']),
  subjectType: z.string().trim().min(1).max(80),
  subjectReference: z.string().trim().min(1).max(200),
  institutionId: z.string().uuid().nullable().optional(),
  priority: z.enum(['normal', 'high', 'urgent']).default('normal'),
  dueAt: z.string().datetime().nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional()
});
export type CreateComplianceRequestDto = z.infer<typeof createComplianceRequestSchema>;

export const requestRestoreSchema = z.object({
  backupSnapshotId: z.string().uuid(),
  environment: z.enum(['staging', 'production']),
  reason: z.string().trim().min(10).max(1000)
});
export type RequestRestoreDto = z.infer<typeof requestRestoreSchema>;

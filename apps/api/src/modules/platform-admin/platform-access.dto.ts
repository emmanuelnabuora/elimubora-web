import { z } from 'zod';

export const accessScopeSchema = z.object({
  scopeType: z.enum(['global', 'county', 'institution', 'resource']),
  scopeId: z.string().trim().min(1).max(160).nullable().optional()
}).superRefine((value, ctx) => {
  if (value.scopeType === 'global' && value.scopeId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scopeId'], message: 'Global scope cannot include scopeId' });
  if (value.scopeType !== 'global' && !value.scopeId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scopeId'], message: 'Scoped access requires scopeId' });
});

export const createRoleSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-z0-9_.-]{2,79}$/),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(600).optional(),
  riskLevel: z.enum(['standard', 'elevated', 'critical']).default('standard'),
  permissionKeys: z.array(z.string().trim()).max(100).default([])
});
export type CreateRoleDto = z.infer<typeof createRoleSchema>;

export const updateRolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string().trim()).max(100),
  reason: z.string().trim().min(8).max(500)
});
export type UpdateRolePermissionsDto = z.infer<typeof updateRolePermissionsSchema>;

export const createGrantSchema = z.object({
  userId: z.string().uuid(),
  roleKey: z.string().trim().min(3).max(80),
  scopeType: z.enum(['global', 'county', 'institution', 'resource']),
  scopeId: z.string().trim().min(1).max(160).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  reason: z.string().trim().min(8).max(500)
}).superRefine((value, ctx) => {
  if (value.scopeType === 'global' && value.scopeId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scopeId'], message: 'Global scope cannot include scopeId' });
  if (value.scopeType !== 'global' && !value.scopeId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scopeId'], message: 'Scoped access requires scopeId' });
  if (value.expiresAt && new Date(value.expiresAt).getTime() <= Date.now()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expiresAt'], message: 'Expiration must be in the future' });
});
export type CreateGrantDto = z.infer<typeof createGrantSchema>;

export const revokeGrantSchema = z.object({ reason: z.string().trim().min(8).max(500) });
export type RevokeGrantDto = z.infer<typeof revokeGrantSchema>;

export const revokePrivilegedSessionSchema = z.object({ reason: z.string().trim().min(8).max(500) });
export type RevokePrivilegedSessionDto = z.infer<typeof revokePrivilegedSessionSchema>;

export const impersonationRequestSchema = z.object({
  targetUserId: z.string().uuid(),
  targetTenantId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().min(15).max(1000),
  ticketReference: z.string().trim().max(120).optional()
});
export type ImpersonationRequestDto = z.infer<typeof impersonationRequestSchema>;

export const impersonationDecisionSchema = z.object({
  action: z.enum(['deny', 'end']),
  reason: z.string().trim().min(8).max(500)
});
export type ImpersonationDecisionDto = z.infer<typeof impersonationDecisionSchema>;

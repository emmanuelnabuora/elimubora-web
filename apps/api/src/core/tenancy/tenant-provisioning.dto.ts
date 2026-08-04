import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, and hyphens only'),
  // 'platform' deliberately excluded — there is exactly one such
  // tenant, created once by tools/bootstrap-platform-admin.mjs, not
  // through this endpoint.
  kind: z.enum(['school', 'county', 'university', 'tvet', 'ministry', 'partner']).default('school'),
  countyCode: z.string().max(10).optional(),
  adminEmail: z.string().email(),
  adminFullName: z.string().min(2).max(200),
  adminPassword: z.string().min(12, 'Must be at least 12 characters')
});
export type CreateTenantDto = z.infer<typeof createTenantSchema>;

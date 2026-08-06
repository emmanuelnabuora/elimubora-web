import { z } from 'zod';

const GRADE_LEVELS = [
  'PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'
] as const;

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
  adminPassword: z.string().min(12, 'Must be at least 12 characters'),

  // Location detail beyond the county code — record-keeping only,
  // stored in tenants.settings (no dedicated columns; nothing here
  // needs SQL-level filtering).
  subCounty: z.string().max(120).optional(),
  ward: z.string().max(120).optional(),
  physicalAddress: z.string().max(500).optional(),

  // Academics: when gradeLevels + streams are both provided, a real
  // class stream is created for every grade x stream combination as
  // part of provisioning -- the one genuinely load-bearing addition
  // here, not just collected data. Both optional: a school can still
  // onboard with zero classes and create them later, same as today.
  academicYear: z.number().int().min(2020).max(2100).optional(),
  gradeLevels: z.array(z.enum(GRADE_LEVELS)).max(14).optional(),
  streams: z.array(z.string().min(1).max(20)).max(10).optional(),

  // Everything below is genuinely just a profile snapshot -- collected
  // for record-keeping and shown back to the admin later, matching
  // what the reference wizard also treats as non-functional. Stored
  // in tenants.settings as a single JSON blob, not normalized into
  // dedicated columns.
  facilities: z.array(z.string().min(1).max(60)).max(30).optional(),
  technology: z
    .object({
      connectivityType: z.string().max(60).optional(),
      provider: z.string().max(120).optional(),
      bandwidthMbps: z.number().int().min(0).max(100000).optional(),
      hasElectricity: z.boolean().optional(),
      hasBackupPower: z.boolean().optional(),
      computersCount: z.number().int().min(0).optional(),
      tabletsCount: z.number().int().min(0).optional(),
      wifiCoverage: z.enum(['None', 'Partial', 'Full']).optional()
    })
    .optional(),
  finance: z
    .object({
      currency: z.string().max(10).optional(),
      paymentMethods: z.array(z.string().min(1).max(40)).max(10).optional(),
      invoicePrefix: z.string().max(10).optional(),
      receiptPrefix: z.string().max(10).optional(),
      mpesaNumber: z.string().max(20).optional()
    })
    .optional(),
  branding: z
    .object({
      primaryColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a hex color like #5B4CF5')
        .optional(),
      secondaryColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a hex color like #23286B')
        .optional()
    })
    .optional()
});
export type CreateTenantDto = z.infer<typeof createTenantSchema>;

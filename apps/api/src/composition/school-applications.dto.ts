import { z } from 'zod';

const GRADE_LEVELS = [
  'PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'
] as const;

/**
 * Public-facing submission. Deliberately narrower than
 * CreateTenantDto (tenant-provisioning.dto.ts): no slug, no admin
 * password, no branding/technology/finance profile fields. Those
 * belong to a platform_admin actually provisioning a tenant right
 * now; an applicant is asking to be considered, not configuring a
 * live school. Slug is chosen at approval time (see
 * approveSchoolApplicationSchema) — a name typed by an unauthenticated
 * visitor shouldn't be squatting a URL before anyone has reviewed
 * anything. A password is never collected here at all — approval
 * sends a normal invitation (core.invitations) to adminEmail, and the
 * admin sets their own password through the same accept flow every
 * other invited user goes through.
 */
export const submitSchoolApplicationSchema = z.object({
  schoolName: z.string().trim().min(2).max(200),
  countyCode: z.string().max(10).optional(),
  subCounty: z.string().max(120).optional(),
  ward: z.string().max(120).optional(),
  physicalAddress: z.string().max(500).optional(),

  shortName: z.string().max(60).optional(),
  registrationNumber: z.string().max(60).optional(),
  educationLevel: z.string().max(80).optional(),
  ownership: z.string().max(60).optional(),
  yearEstablished: z.string().max(4).optional(),
  motto: z.string().max(200).optional(),

  adminFullName: z.string().trim().min(2).max(200),
  adminEmail: z.string().email(),
  adminPhone: z.string().max(20).optional(),

  contacts: z
    .array(
      z.object({
        role: z.string().max(80),
        fullName: z.string().max(200),
        phone: z.string().max(20).optional(),
        email: z.string().email().optional(),
        preferredChannel: z.enum(['EMAIL', 'PHONE', 'SMS']).optional()
      })
    )
    .max(20)
    .optional(),

  // Same "genuinely functional" fields as CreateTenantDto: when all
  // three are present, approval creates a real class stream per
  // grade x stream combination.
  academicYear: z.number().int().min(2020).max(2100).optional(),
  gradeLevels: z.array(z.enum(GRADE_LEVELS)).max(14).optional(),
  streams: z
    .array(z.string().min(1).max(20))
    .max(10)
    .refine(
      (streams) => {
        const normalized = streams.map((s) => s.trim().toUpperCase());
        return new Set(normalized).size === normalized.length;
      },
      { message: 'Stream names must be unique (case-insensitive).' }
    )
    .optional(),

  notes: z.string().max(2000).optional()
});
export type SubmitSchoolApplicationDto = z.infer<typeof submitSchoolApplicationSchema>;

export const checkSchoolApplicationStatusSchema = z.object({
  token: z.string().min(1)
});
export type CheckSchoolApplicationStatusDto = z.infer<typeof checkSchoolApplicationStatusSchema>;

export const listSchoolApplicationsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional()
});
export type ListSchoolApplicationsQueryDto = z.infer<typeof listSchoolApplicationsQuerySchema>;

/**
 * A platform_admin can override the auto-suggested slug (derived
 * from schoolName, same slugify() the existing onboarding wizard
 * uses client-side) before it becomes permanent — the one thing about
 * the resulting tenant an applicant never got to specify themselves.
 */
export const approveSchoolApplicationSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, and hyphens only')
    .optional(),
  kind: z.enum(['school', 'county', 'university', 'tvet', 'ministry', 'partner']).default('school')
});
export type ApproveSchoolApplicationDto = z.infer<typeof approveSchoolApplicationSchema>;

export const rejectSchoolApplicationSchema = z.object({
  reason: z.string().trim().min(1).max(2000)
});
export type RejectSchoolApplicationDto = z.infer<typeof rejectSchoolApplicationSchema>;

import { z } from 'zod';

export const refreshSnapshotSchema = z.object({
  academicYear: z.number().int().min(2020).max(2100)
});
export type RefreshSnapshotDto = z.infer<typeof refreshSnapshotSchema>;

export const snapshotQuerySchema = z.object({
  academicYear: z.coerce.number().int().min(2020).max(2100),
  countyCode: z.string().max(10).optional()
});
export type SnapshotQueryDto = z.infer<typeof snapshotQuerySchema>;

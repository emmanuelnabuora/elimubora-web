import { z } from 'zod';

export const collectionSummaryQuerySchema = z.object({
  academicYear: z.coerce.number().int().min(2020).max(2100),
  term: z.coerce.number().int().min(1).max(3).optional()
});
export type CollectionSummaryQueryDto = z.infer<typeof collectionSummaryQuerySchema>;

export const earlyWarningQuerySchema = z.object({
  academicYear: z.coerce.number().int().min(2020).max(2100)
});
export type EarlyWarningQueryDto = z.infer<typeof earlyWarningQuerySchema>;

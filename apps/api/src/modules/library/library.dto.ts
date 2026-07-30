import { z } from 'zod';

const gradeLevelSchema = z.enum([
  'PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'
]);

export const createResourceSchema = z.object({
  title: z.string().min(2).max(300),
  resourceType: z.enum(['book', 'video', 'simulation', 'past_paper', 'teacher_guide', 'interactive']),
  subject: z.string().min(2).max(100),
  gradeLevel: gradeLevelSchema.optional(),
  description: z.string().max(5000).optional(),
  storageKey: z.string().min(1).max(500),
  tags: z.array(z.string().min(1).max(50)).max(20).default([])
});
export type CreateResourceDto = z.infer<typeof createResourceSchema>;

export const listResourcesQuerySchema = z.object({
  subject: z.string().max(100).optional(),
  gradeLevel: gradeLevelSchema.optional(),
  resourceType: z
    .enum(['book', 'video', 'simulation', 'past_paper', 'teacher_guide', 'interactive'])
    .optional(),
  tag: z.string().max(50).optional()
});
export type ListResourcesQueryDto = z.infer<typeof listResourcesQuerySchema>;

export const logAccessSchema = z.object({
  action: z.enum(['viewed', 'downloaded'])
});
export type LogAccessDto = z.infer<typeof logAccessSchema>;

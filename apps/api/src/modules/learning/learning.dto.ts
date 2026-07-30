import { z } from 'zod';

const gradeLevelSchema = z.enum([
  'PP1', 'PP2',
  'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'
]);

export const createCourseSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  learningArea: z.string().min(2).max(100),
  gradeLevel: gradeLevelSchema
});
export type CreateCourseDto = z.infer<typeof createCourseSchema>;

export const updateCourseSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional()
});
export type UpdateCourseDto = z.infer<typeof updateCourseSchema>;

export const createModuleSchema = z.object({
  title: z.string().min(2).max(200),
  position: z.number().int().min(0)
});
export type CreateModuleDto = z.infer<typeof createModuleSchema>;

export const createLessonSchema = z.object({
  title: z.string().min(2).max(200),
  position: z.number().int().min(0),
  content: z.record(z.unknown()).default({})
});
export type CreateLessonDto = z.infer<typeof createLessonSchema>;

export const createAssignmentSchema = z.object({
  title: z.string().min(2).max(200),
  instructions: z.string().max(20_000).optional(),
  dueAt: z.string().datetime().optional(),
  maxScore: z.number().positive().max(1000).default(100),
  rubric: z.record(z.unknown()).optional(),
  competencyIds: z.array(z.string().uuid()).default([])
});
export type CreateAssignmentDto = z.infer<typeof createAssignmentSchema>;

export const enrollSchema = z.object({
  userId: z.string().uuid(),
  courseRole: z.enum(['learner', 'teacher'])
});
export type EnrollDto = z.infer<typeof enrollSchema>;

export const gradeSubmissionSchema = z.object({
  score: z.number().min(0).max(1000),
  rubricLevels: z.record(z.enum(['EE', 'ME', 'AE', 'BE'])).optional(),
  feedback: z.string().max(10_000).optional()
});
export type GradeSubmissionDto = z.infer<typeof gradeSubmissionSchema>;

/**
 * Shape a client submits when creating a submission ONLINE (the
 * synchronous path). The offline path uses the same fields inside a
 * sync mutation payload — see submission-sync.handler.ts.
 */
export const createSubmissionSchema = z.object({
  content: z.record(z.unknown())
});
export type CreateSubmissionDto = z.infer<typeof createSubmissionSchema>;

import { z } from 'zod';

export const markAttendanceSchema = z.object({
  classStreamId: z.string().uuid(),
  learnerId: z.string().uuid(),
  attendanceDate: z.string().date(),
  status: z.enum(['present', 'absent', 'late', 'excused'])
});
export type MarkAttendanceDto = z.infer<typeof markAttendanceSchema>;

export const createLessonPlanSchema = z.object({
  courseId: z.string().uuid(),
  weekOf: z.string().date(),
  objectives: z.string().max(5000).optional(),
  activities: z.array(z.record(z.unknown())).default([]),
  resources: z.string().max(2000).optional()
});
export type CreateLessonPlanDto = z.infer<typeof createLessonPlanSchema>;

export const draftLessonPlanWithAiSchema = z.object({
  courseId: z.string().uuid(),
  weekOf: z.string().date(),
  topic: z.string().min(2).max(500)
});
export type DraftLessonPlanWithAiDto = z.infer<typeof draftLessonPlanWithAiSchema>;

export const updateLessonPlanStatusSchema = z.object({
  status: z.enum(['draft', 'submitted', 'approved'])
});
export type UpdateLessonPlanStatusDto = z.infer<typeof updateLessonPlanStatusSchema>;

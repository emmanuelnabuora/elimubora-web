import { z } from 'zod';

const gradeLevelSchema = z.enum([
  'PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'
]);

export const createQuestionBankSchema = z.object({
  title: z.string().min(2).max(200),
  subject: z.string().min(2).max(100),
  gradeLevel: gradeLevelSchema
});
export type CreateQuestionBankDto = z.infer<typeof createQuestionBankSchema>;

const mcqOptionSchema = z.object({ id: z.string().min(1).max(10), text: z.string().min(1).max(500) });

export const createQuestionSchema = z
  .object({
    questionType: z.enum(['mcq', 'short_answer', 'essay']),
    prompt: z.string().min(1).max(5000),
    options: z.array(mcqOptionSchema).min(2).max(10).optional(),
    correctOptionId: z.string().min(1).max(10).optional(),
    marks: z.number().positive().max(1000),
    competencyIds: z.array(z.string().uuid()).default([])
  })
  .refine((v) => v.questionType !== 'mcq' || (v.options && v.correctOptionId), {
    message: 'MCQ questions require options and a correctOptionId',
    path: ['options']
  })
  .refine(
    (v) => v.questionType !== 'mcq' || v.options?.some((o) => o.id === v.correctOptionId),
    { message: 'correctOptionId must match one of the provided option ids', path: ['correctOptionId'] }
  );
export type CreateQuestionDto = z.infer<typeof createQuestionSchema>;

export const createExamSchema = z.object({
  courseId: z.string().uuid(),
  questionBankId: z.string().uuid(),
  title: z.string().min(2).max(200),
  durationMinutes: z.number().int().positive().max(600),
  questionCount: z.number().int().positive().max(200)
});
export type CreateExamDto = z.infer<typeof createExamSchema>;

export const updateExamStatusSchema = z.object({
  status: z.enum(['draft', 'published', 'closed'])
});
export type UpdateExamStatusDto = z.infer<typeof updateExamStatusSchema>;

export const submitAttemptSchema = z.object({
  answers: z.record(z.string().max(20_000))
});
export type SubmitAttemptDto = z.infer<typeof submitAttemptSchema>;

export const gradeAttemptSchema = z.object({
  manualScore: z.number().min(0).max(10_000)
});
export type GradeAttemptDto = z.infer<typeof gradeAttemptSchema>;

export const issueCertificateSchema = z.object({
  studentId: z.string().uuid(),
  title: z.string().min(2).max(300)
});
export type IssueCertificateDto = z.infer<typeof issueCertificateSchema>;

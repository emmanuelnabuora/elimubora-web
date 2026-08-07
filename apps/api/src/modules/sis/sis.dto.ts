import { z } from 'zod';
import { imageDataUrlSchema } from '../../core/http/image-data-url.schema';

const gradeLevelSchema = z.enum([
  'PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'
]);

export const createApplicationSchema = z.object({
  candidateName: z.string().min(2).max(200),
  dateOfBirth: z.string().date().optional(),
  guardianName: z.string().min(2).max(200),
  guardianPhone: z.string().min(7).max(20),
  gradeLevelApplied: gradeLevelSchema
});
export type CreateApplicationDto = z.infer<typeof createApplicationSchema>;

export const decideApplicationSchema = z.object({
  status: z.enum(['admitted', 'rejected', 'waitlisted']),
  notes: z.string().max(2000).optional()
});
export type DecideApplicationDto = z.infer<typeof decideApplicationSchema>;

export const enrollStudentSchema = z.object({
  applicationId: z.string().uuid().optional(),
  fullName: z.string().min(2).max(200),
  dateOfBirth: z.string().date().optional(),
  gender: z.enum(['male', 'female']).optional(),
  address: z.string().max(500).optional(),
  emergencyContactName: z.string().max(200).optional(),
  emergencyContactPhone: z.string().min(7).max(20).optional(),
  gradeLevel: gradeLevelSchema,
  classStreamId: z.string().uuid().optional(),
  academicYear: z.number().int().min(2020).max(2100)
});
export type EnrollStudentDto = z.infer<typeof enrollStudentSchema>;

export const createGuardianSchema = z.object({
  fullName: z.string().min(2).max(200),
  phone: z.string().min(7).max(20).optional(),
  email: z.string().email().optional(),
  nationalId: z.string().max(30).optional(),
  physicalAddress: z.string().max(500).optional()
});
export type CreateGuardianDto = z.infer<typeof createGuardianSchema>;

export const linkGuardianSchema = z.object({
  guardianId: z.string().uuid(),
  relationship: z.string().min(2).max(50),
  isPrimary: z.boolean().default(false),
  canPickup: z.boolean().default(true)
});
export type LinkGuardianDto = z.infer<typeof linkGuardianSchema>;

export const linkGuardianAccountSchema = z.object({
  userId: z.string().uuid()
});
export type LinkGuardianAccountDto = z.infer<typeof linkGuardianAccountSchema>;

export const updateMedicalSchema = z.object({
  bloodGroup: z.string().max(10).optional(),
  allergies: z.string().max(2000).optional(),
  medicalNotes: z.string().max(5000).optional()
});
export type UpdateMedicalDto = z.infer<typeof updateMedicalSchema>;

export const updatePhotoSchema = z.object({
  photoDataUrl: imageDataUrlSchema
});
export type UpdatePhotoDto = z.infer<typeof updatePhotoSchema>;

export const updateStudentDetailsSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(['male', 'female']).optional(),
  address: z.string().max(500).optional(),
  emergencyContactName: z.string().max(200).optional(),
  emergencyContactPhone: z.string().max(20).optional()
});
export type UpdateStudentDetailsDto = z.infer<typeof updateStudentDetailsSchema>;


export const createClassStreamSchema = z.object({
  name: z.string().min(2).max(100),
  gradeLevel: gradeLevelSchema,
  academicYear: z.number().int().min(2020).max(2100),
  homeroomTeacherId: z.string().uuid().optional()
});
export type CreateClassStreamDto = z.infer<typeof createClassStreamSchema>;

export const requestTransferSchema = z.object({
  toTenantId: z.string().uuid(),
  reason: z.string().max(2000).optional()
});
export type RequestTransferDto = z.infer<typeof requestTransferSchema>;

export const decideTransferSchema = z.object({
  status: z.enum(['accepted', 'rejected'])
});
export type DecideTransferDto = z.infer<typeof decideTransferSchema>;

export const graduateStudentSchema = z.object({
  cohortYear: z.number().int().min(2020).max(2100),
  notes: z.string().max(2000).optional()
});
export type GraduateStudentDto = z.infer<typeof graduateStudentSchema>;

export const createBehaviourNoteSchema = z.object({
  category: z.enum(['positive', 'concern', 'incident']),
  note: z.string().min(1).max(5000),
  occurredAt: z.string().datetime().optional()
});
export type CreateBehaviourNoteDto = z.infer<typeof createBehaviourNoteSchema>;

export const activateAccountSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, 'Must be at least 12 characters')
});
export type ActivateAccountDto = z.infer<typeof activateAccountSchema>;

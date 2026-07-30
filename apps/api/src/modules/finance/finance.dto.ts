import { z } from 'zod';

const gradeLevelSchema = z.enum([
  'PP1', 'PP2', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'
]);

export const createFeeStructureSchema = z.object({
  gradeLevel: gradeLevelSchema,
  academicYear: z.number().int().min(2020).max(2100),
  term: z.number().int().min(1).max(3),
  amount: z.number().positive(),
  description: z.string().max(2000).optional()
});
export type CreateFeeStructureDto = z.infer<typeof createFeeStructureSchema>;

export const createInvoiceSchema = z.object({
  studentId: z.string().uuid(),
  feeStructureId: z.string().uuid(),
  dueDate: z.string().date().optional()
});
export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;

export const recordManualPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['bank', 'cash', 'cheque']),
  reference: z.string().min(1).max(200)
});
export type RecordManualPaymentDto = z.infer<typeof recordManualPaymentSchema>;

export const initiateMpesaPaymentSchema = z.object({
  amount: z.number().positive(),
  phone: z.string().regex(/^\+254\d{9}$/, 'Expected +254XXXXXXXXX')
});
export type InitiateMpesaPaymentDto = z.infer<typeof initiateMpesaPaymentSchema>;

/** In production this shape mirrors Safaricom's Daraja callback payload closely enough
 *  to swap adapters without changing this endpoint's contract. */
export const mpesaCallbackSchema = z.object({
  reference: z.string().min(1),
  status: z.enum(['confirmed', 'failed'])
});
export type MpesaCallbackDto = z.infer<typeof mpesaCallbackSchema>;

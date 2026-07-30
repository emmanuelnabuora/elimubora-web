export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'waived';
export type PaymentMethod = 'mpesa' | 'bank' | 'cash' | 'cheque';
export type PaymentStatus = 'pending' | 'confirmed' | 'failed';

export interface FeeStructure {
  id: string;
  gradeLevel: string;
  academicYear: number;
  term: number;
  amount: string;
  description: string | null;
}

export interface Invoice {
  id: string;
  studentId: string;
  feeStructureId: string;
  academicYear: number;
  term: number;
  amountDue: string;
  amountPaid: string;
  status: InvoiceStatus;
  dueDate: string | null;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: string;
  method: PaymentMethod;
  reference: string;
  status: PaymentStatus;
  recordedBy: string | null;
  paidAt: string | null;
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import type {
  CreateFeeStructureDto,
  CreateInvoiceDto,
  InitiateMpesaPaymentDto,
  RecordManualPaymentDto
} from './finance.dto';
import { FinanceRepository } from './finance.repository';
import type { FeeStructure, Invoice, Payment } from './finance.types';

const ADMIN_ROLES = new Set(['school_admin', 'principal', 'platform_admin']);

@Injectable()
export class FinanceService {
  constructor(private readonly repo: FinanceRepository) {}

  private requireAdmin(user: AuthenticatedUser): void {
    if (!ADMIN_ROLES.has(user.role)) {
      throw new ForbiddenException('Only school administration can perform this action');
    }
  }

  async createFeeStructure(user: AuthenticatedUser, dto: CreateFeeStructureDto): Promise<FeeStructure> {
    this.requireAdmin(user);
    return this.repo.createFeeStructure(dto);
  }

  async createInvoice(user: AuthenticatedUser, dto: CreateInvoiceDto): Promise<Invoice> {
    this.requireAdmin(user);
    return this.repo.createInvoice(dto);
  }

  async getInvoice(id: string): Promise<Invoice> {
    const invoice = await this.repo.findInvoice(id);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  listInvoicesForStudent(studentId: string): Promise<Invoice[]> {
    return this.repo.listInvoicesForStudent(studentId);
  }

  listPayments(invoiceId: string): Promise<Payment[]> {
    return this.repo.listPaymentsForInvoice(invoiceId);
  }

  async recordManualPayment(
    user: AuthenticatedUser,
    invoiceId: string,
    dto: RecordManualPaymentDto
  ) {
    this.requireAdmin(user);
    return this.repo.recordManualPayment({ ...dto, invoiceId, recordedBy: user.userId });
  }

  async initiateMpesaPayment(
    user: AuthenticatedUser,
    invoiceId: string,
    dto: InitiateMpesaPaymentDto
  ): Promise<Payment> {
    // Any authenticated tenant member may pay an invoice (a parent
    // paying their child's fees is the common case) — no admin gate here.
    void user;
    return this.repo.initiateMpesaPayment({ ...dto, invoiceId });
  }

  /** Webhook target — see FinanceController for the @Public() boundary. */
  async confirmGatewayCallback(reference: string, status: 'confirmed' | 'failed') {
    const result = await this.repo.confirmGatewayPayment(reference, status);
    if (!result) throw new NotFoundException('No matching pending payment for this reference');
    return result;
  }
}

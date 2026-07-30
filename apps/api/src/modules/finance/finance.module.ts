import { Module } from '@nestjs/common';
import { FeeStructuresController, InvoicesController, MpesaCallbackController } from './finance.controller';
import { FinanceRepository } from './finance.repository';
import { FinanceService } from './finance.service';

/**
 * Finance (Module 5 — Sprint 9 scope): fee structures, invoices,
 * manual and M-Pesa-sandbox payments. Scholarships, bursaries,
 * budgets, procurement, and full financial reporting are deferred to
 * dedicated future sprints.
 */
@Module({
  controllers: [FeeStructuresController, InvoicesController, MpesaCallbackController],
  providers: [FinanceRepository, FinanceService],
  exports: [FinanceRepository]
})
export class FinanceModule {}

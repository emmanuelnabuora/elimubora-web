import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Public } from '../../core/auth/public.decorator';
import { CurrentUser } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import {
  createFeeStructureSchema,
  createInvoiceSchema,
  initiateMpesaPaymentSchema,
  mpesaCallbackSchema,
  recordManualPaymentSchema,
  type CreateFeeStructureDto,
  type CreateInvoiceDto,
  type InitiateMpesaPaymentDto,
  type MpesaCallbackDto,
  type RecordManualPaymentDto
} from './finance.dto';
import { FinanceService } from './finance.service';

@Controller('fee-structures')
export class FeeStructuresController {
  constructor(private readonly service: FinanceService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createFeeStructureSchema)) dto: CreateFeeStructureDto
  ) {
    return this.service.createFeeStructure(user, dto);
  }
}

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly service: FinanceService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createInvoiceSchema)) dto: CreateInvoiceDto
  ) {
    return this.service.createInvoice(user, dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getInvoice(id);
  }

  @Get('student/:studentId')
  forStudent(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.service.listInvoicesForStudent(studentId);
  }

  @Get(':id/payments')
  payments(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listPayments(id);
  }

  @Post(':id/payments/manual')
  recordManual(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(recordManualPaymentSchema)) dto: RecordManualPaymentDto
  ) {
    return this.service.recordManualPayment(user, id, dto);
  }

  @Post(':id/payments/mpesa/initiate')
  initiateMpesa(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(initiateMpesaPaymentSchema)) dto: InitiateMpesaPaymentDto
  ) {
    return this.service.initiateMpesaPayment(user, id, dto);
  }
}

/**
 * Public webhook target. In production this is where Safaricom's
 * Daraja callback lands; there is no bearer token because the caller
 * is Safaricom, not a logged-in user. Trust comes entirely from the
 * unguessable gateway-issued reference, looked up via a SECURITY
 * DEFINER function (migration 0010) — see FinanceRepository.
 */
@Controller('payments/mpesa')
export class MpesaCallbackController {
  constructor(private readonly service: FinanceService) {}

  @Public()
  @Post('callback')
  callback(@Body(new ZodValidationPipe(mpesaCallbackSchema)) dto: MpesaCallbackDto) {
    return this.service.confirmGatewayCallback(dto.reference, dto.status);
  }
}

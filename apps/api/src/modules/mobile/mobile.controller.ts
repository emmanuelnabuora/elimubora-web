import { Body, Controller, Get, HttpCode, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import {
  registerDeviceSchema,
  redeemAttendanceQrForStudentSchema,
  redeemAttendanceQrSchema,
  startAttendanceSessionSchema,
  unregisterDeviceSchema,
  uploadSchema,
  type RedeemAttendanceQrDto,
  type RedeemAttendanceQrForStudentDto,
  type RegisterDeviceDto,
  type StartAttendanceSessionDto,
  type UnregisterDeviceDto,
  type UploadDto
} from './mobile.dto';
import { MobileService } from './mobile.service';

@Controller('mobile/devices')
export class DevicesController {
  constructor(private readonly service: MobileService) {}

  @Post()
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(registerDeviceSchema)) dto: RegisterDeviceDto
  ) {
    return this.service.registerDevice(user, dto);
  }

  @Post('unregister')
  @HttpCode(204)
  async unregister(
    @Body(new ZodValidationPipe(unregisterDeviceSchema)) dto: UnregisterDeviceDto
  ): Promise<void> {
    await this.service.unregisterDevice(dto.pushToken);
  }
}

@Controller('mobile/uploads')
export class UploadsController {
  constructor(private readonly service: MobileService) {}

  @Post()
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(uploadSchema)) dto: UploadDto
  ) {
    return this.service.upload(user, dto);
  }

  @Get(':storageKey')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storageKey') storageKey: string,
    @Res() res: Response
  ): Promise<void> {
    const { bytes, contentType } = await this.service.getUploadBytes(user, storageKey);
    res.setHeader('content-type', contentType);
    res.send(bytes);
  }
}

@Controller('mobile/attendance-qr')
export class AttendanceQrController {
  constructor(private readonly service: MobileService) {}

  @Post('session')
  startSession(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(startAttendanceSessionSchema)) dto: StartAttendanceSessionDto
  ) {
    return this.service.startAttendanceSession(user, dto);
  }

  @Post('redeem')
  @HttpCode(204)
  async redeem(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(redeemAttendanceQrSchema)) dto: RedeemAttendanceQrDto
  ): Promise<void> {
    await this.service.redeemAttendanceQr(user, dto);
  }

  @Post('redeem-for')
  @HttpCode(204)
  async redeemForStudent(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(redeemAttendanceQrForStudentSchema)) dto: RedeemAttendanceQrForStudentDto
  ): Promise<void> {
    await this.service.redeemAttendanceQrForStudent(user, dto);
  }
}

import { Module } from '@nestjs/common';
import { AttendanceQrService } from './attendance-qr.service';
import {
  AttendanceQrController,
  DevicesController,
  UploadsController
} from './mobile.controller';
import { MobileRepository } from './mobile.repository';
import { MobileService } from './mobile.service';

/**
 * Mobile Apps (Module 15 — Sprint 15 scope): device registration for
 * push notifications, camera photo uploads, and QR-based attendance
 * check-in. Offline/background sync needs no new backend work —
 * Sprint 4's sync engine already serves this purpose. Native app
 * client code (Swift/Kotlin/React Native) is not built here — no
 * compiler, SDK, or simulator exists in this environment to verify it.
 */
@Module({
  controllers: [DevicesController, UploadsController, AttendanceQrController],
  providers: [MobileRepository, MobileService, AttendanceQrService]
})
export class MobileModule {}

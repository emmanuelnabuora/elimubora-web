import { Module } from '@nestjs/common';
import {
  AdmissionsController,
  ClassStreamsController,
  GuardiansController,
  StudentsController,
  TransfersController
} from './sis.controller';
import { SisRepository } from './sis.repository';
import { SisService } from './sis.service';

/**
 * Student Information System (Module 3 — Sprint 5 scope). Depends on
 * the core UserProvisioningService to create a system identity for
 * each enrolled student without importing the identity module.
 */
@Module({
  controllers: [
    AdmissionsController,
    ClassStreamsController,
    GuardiansController,
    StudentsController,
    TransfersController
  ],
  providers: [SisRepository, SisService],
  exports: [SisRepository]
})
export class SisModule {}

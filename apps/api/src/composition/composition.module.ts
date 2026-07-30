import { Module } from '@nestjs/common';
import { CommsModule } from '../modules/comms/comms.module';
import { FinanceModule } from '../modules/finance/finance.module';
import { LearningModule } from '../modules/learning/learning.module';
import { SisModule } from '../modules/sis/sis.module';
import { TeacherPortalModule } from '../modules/teacher-portal/teacher-portal.module';
import { ParentPortalController } from './parent-portal.controller';
import { TeacherDashboardController } from './teacher-dashboard.controller';

/**
 * Cross-module read composition (ADR-008). Imports the domain
 * modules whose exported repositories it needs — the idiomatic Nest
 * way to share a provider — rather than redeclaring them, so there is
 * exactly one instance of each repository. This import direction is
 * the one explicitly permitted one: `modules-cannot-import-composition`
 * (dependency-cruiser) ensures no domain module ever imports back.
 */
@Module({
  imports: [LearningModule, TeacherPortalModule, SisModule, CommsModule, FinanceModule],
  controllers: [TeacherDashboardController, ParentPortalController]
})
export class CompositionModule {}

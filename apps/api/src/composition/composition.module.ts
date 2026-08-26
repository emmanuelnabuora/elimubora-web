import { Module } from '@nestjs/common';
import { AssessmentModule } from '../modules/assessment/assessment.module';
import { CommsModule } from '../modules/comms/comms.module';
import { FinanceModule } from '../modules/finance/finance.module';
import { IdentityModule } from '../modules/identity/identity.module';
import { LearningModule } from '../modules/learning/learning.module';
import { SchoolAdminModule } from '../modules/school-admin/school-admin.module';
import { SisModule } from '../modules/sis/sis.module';
import { TeacherPortalModule } from '../modules/teacher-portal/teacher-portal.module';
import { AnalyticsController } from './analytics.controller';
import { AnnouncementsReadController } from './announcements.controller';
import { GuardianInvitationsController } from './guardian-invitations.controller';
import { ParentPortalController } from './parent-portal.controller';
import { SchoolApplicationsController } from './school-applications.controller';
import { SchoolApplicationsService } from './school-applications.service';
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
  imports: [
    LearningModule,
    TeacherPortalModule,
    SisModule,
    CommsModule,
    FinanceModule,
    SchoolAdminModule,
    IdentityModule,
    AssessmentModule
  ],
  controllers: [
    TeacherDashboardController,
    ParentPortalController,
    AnalyticsController,
    AnnouncementsReadController,
    GuardianInvitationsController,
    SchoolApplicationsController
  ],
  providers: [SchoolApplicationsService]
})
export class CompositionModule {}

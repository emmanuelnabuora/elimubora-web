import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { TenancyMiddleware } from './core/tenancy/tenancy.middleware';
import { CommsModule } from './modules/comms/comms.module';
import { IdentityModule } from './modules/identity/identity.module';
import { LearningModule } from './modules/learning/learning.module';
import { SisModule } from './modules/sis/sis.module';
import { TeacherPortalModule } from './modules/teacher-portal/teacher-portal.module';
import { FinanceModule } from './modules/finance/finance.module';
import { SchoolAdminModule } from './modules/school-admin/school-admin.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { GovernmentModule } from './modules/government/government.module';
import { LibraryModule } from './modules/library/library.module';
import { CompositionModule } from './composition/composition.module';

/**
 * Root module. CoreModule provides platform services globally; domain
 * modules live under src/modules/<name> and may depend on core — never
 * on each other (enforced by dependency-cruiser in CI).
 */
@Module({
  imports: [CoreModule, IdentityModule, LearningModule, SisModule, TeacherPortalModule, CommsModule, SchoolAdminModule, FinanceModule, LibraryModule, AssessmentModule, GovernmentModule, CompositionModule]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenancyMiddleware).forRoutes('*');
  }
}

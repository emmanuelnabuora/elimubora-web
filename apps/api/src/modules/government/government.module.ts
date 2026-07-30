import { Module } from '@nestjs/common';
import { GovernmentController } from './government.controller';
import { GovernmentRepository } from './government.repository';
import { GovernmentService } from './government.service';

/**
 * Government Dashboard (Module 9 — Sprint 13 scope): county/national
 * enrollment and attendance rollups via a worker-role-refreshed
 * snapshot layer. Teacher Distribution, Infrastructure, Funding,
 * School Performance, Policy Monitoring, Inspection Reports, and an
 * Early Warning System follow the identical snapshot pattern and are
 * deferred to dedicated future work.
 */
@Module({
  controllers: [GovernmentController],
  providers: [GovernmentRepository, GovernmentService]
})
export class GovernmentModule {}

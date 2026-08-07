import { Module } from '@nestjs/common';
import { LeaveRequestsController, RoomsController, TimetableController } from './school-admin.controller';
import { SchoolAdminRepository } from './school-admin.repository';
import { SchoolAdminService } from './school-admin.service';

/**
 * School Administration (Module 4 — Sprint 8 scope): rooms,
 * timetabling with database-enforced conflict prevention, and leave
 * requests. Transport, Hostels, Meals, Inventory, Assets, Procurement,
 * Maintenance and Payroll are each real sub-systems deferred to
 * dedicated future sprints — not built here.
 */
@Module({
  controllers: [RoomsController, TimetableController, LeaveRequestsController],
  providers: [SchoolAdminRepository, SchoolAdminService],
  exports: [SchoolAdminRepository]
})
export class SchoolAdminModule {}

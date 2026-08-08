import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles } from '../../core/auth/decorators';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import { ZodValidationPipe } from '../../core/http/zod-validation.pipe';
import {
  requestExportSchema,
  resolveReviewSchema,
  updateModelSchema,
  updatePolicySchema,
  updateRetentionSchema,
  type RequestExportDto,
  type ResolveReviewDto,
  type UpdateModelDto,
  type UpdatePolicyDto,
  type UpdateRetentionDto
} from './platform-intelligence.dto';
import { PlatformIntelligenceService } from './platform-intelligence.service';

@Controller('platform-admin/intelligence')
@Roles('platform_admin')
export class PlatformIntelligenceController {
  constructor(private readonly service: PlatformIntelligenceService) {}

  private days(value?: string) {
    const parsed = Number(value || 30);
    return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 365)) : 30;
  }

  @Get('analytics/national')
  national(@Query('days') days?: string) {
    return this.service.nationalOverview(this.days(days));
  }

  @Get('analytics/counties')
  counties(@Query('days') days?: string) {
    return this.service.countyAnalytics(this.days(days));
  }

  @Get('ai/models')
  models() {
    return this.service.aiModels();
  }

  @Patch('ai/models/:id')
  updateModel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateModelSchema)) dto: UpdateModelDto
  ) {
    return this.service.updateModel(user, id, dto);
  }

  @Get('ai/policies')
  policies() {
    return this.service.aiPolicies();
  }

  @Patch('ai/policies/:id')
  updatePolicy(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePolicySchema)) dto: UpdatePolicyDto
  ) {
    return this.service.updatePolicy(user, id, dto);
  }

  @Get('ai/usage')
  usage(@Query('days') days?: string) {
    return this.service.aiUsage(this.days(days));
  }

  @Get('ai/reviews')
  reviews() {
    return this.service.aiReviews();
  }

  @Patch('ai/reviews/:id')
  resolveReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resolveReviewSchema)) dto: ResolveReviewDto
  ) {
    return this.service.resolveReview(user, id, dto);
  }

  @Get('data/quality')
  quality() {
    return this.service.dataQuality();
  }

  @Get('data/exports')
  exports() {
    return this.service.exports();
  }

  @Post('data/exports')
  requestExport(@CurrentUser() user: AuthenticatedUser, @Body(new ZodValidationPipe(requestExportSchema)) dto: RequestExportDto) {
    return this.service.requestExport(user, dto);
  }

  @Get('data/migrations')
  migrations() {
    return this.service.migrations();
  }

  @Get('data/retention')
  retention() {
    return this.service.retentionPolicies();
  }

  @Patch('data/retention/:id')
  updateRetention(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRetentionSchema)) dto: UpdateRetentionDto
  ) {
    return this.service.updateRetention(user, id, dto);
  }
}

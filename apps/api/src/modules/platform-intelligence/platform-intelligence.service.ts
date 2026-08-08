import { Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import type {
  RequestExportDto,
  ResolveReviewDto,
  UpdateModelDto,
  UpdatePolicyDto,
  UpdateRetentionDto
} from './platform-intelligence.dto';
import { PlatformIntelligenceRepository } from './platform-intelligence.repository';

@Injectable()
export class PlatformIntelligenceService {
  constructor(private readonly repo: PlatformIntelligenceRepository) {}

  nationalOverview(days = 30) {
    return this.repo.query(
      `select metric_date, metric_key, metric_value, dimensions
       from platform.analytics_daily
       where scope_type='national'
         and metric_date >= current_date - $1::int
       order by metric_date, metric_key`,
      [days]
    );
  }

  countyAnalytics(days = 30) {
    return this.repo.query(
      `select metric_date, scope_key as county, metric_key, metric_value, dimensions
       from platform.analytics_daily
       where scope_type='county'
         and metric_date >= current_date - $1::int
       order by metric_date desc, county, metric_key`,
      [days]
    );
  }

  aiModels() {
    return this.repo.query(
      `select id, code, provider, display_name, model_version, purpose, status,
              data_classification, active, input_token_cost_micros, output_token_cost_micros
       from platform.ai_models order by display_name`
    );
  }

  aiPolicies() {
    return this.repo.query(
      `select id, code, name, description, policy_scope, scope_filter, enabled, rules, updated_at
       from platform.ai_policies order by name`
    );
  }

  aiUsage(days = 30) {
    return this.repo.query(
      `select usage_date, role_code, feature_code, model_code,
              sum(request_count)::bigint request_count,
              sum(blocked_count)::bigint blocked_count,
              sum(input_tokens)::bigint input_tokens,
              sum(output_tokens)::bigint output_tokens,
              sum(estimated_cost_micros)::bigint estimated_cost_micros
       from platform.ai_usage_daily
       where usage_date >= current_date - $1::int
       group by usage_date, role_code, feature_code, model_code
       order by usage_date desc`,
      [days]
    );
  }

  aiReviews() {
    return this.repo.query(
      `select id, institution_id, feature_code, model_code, risk_category,
              severity, status, reason_code, assigned_to, created_at
       from platform.ai_review_queue
       order by case severity when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
                created_at desc
       limit 250`
    );
  }

  dataQuality() {
    return this.repo.query(
      `select id, institution_id, domain, issue_code, severity, entity_type,
              entity_id, summary, status, detected_at
       from platform.data_quality_issues
       order by case severity when 'critical' then 1 when 'error' then 2 when 'warning' then 3 else 4 end,
                detected_at desc
       limit 500`
    );
  }

  exports() {
    return this.repo.query(
      `select id, requested_by, institution_id, export_type, format, status,
              row_count, failure_code, expires_at, created_at, completed_at
       from platform.data_exports order by created_at desc limit 250`
    );
  }

  migrations() {
    return this.repo.query(
      `select id, institution_id, source_system, job_type, status, records_total,
              records_processed, records_failed, failure_code, created_at, started_at, completed_at
       from platform.migration_jobs order by created_at desc limit 250`
    );
  }

  retentionPolicies() {
    return this.repo.query(
      `select id, domain, retention_days, archive_after_days, legal_hold, notes, updated_at
       from platform.retention_policies order by domain`
    );
  }

  async updateModel(user: AuthenticatedUser, id: string, dto: UpdateModelDto) {
    const rows = await this.repo.query<{ id: string }>(
      `update platform.ai_models
       set status=$2, active=$3, updated_at=now(), row_version=row_version+1
       where id=$1
       returning id, code, display_name, status, active`,
      [id, dto.status, dto.active]
    );
    if (!rows.length) throw new NotFoundException('AI model not found');
    await this.audit(user, 'platform.ai_model.updated', 'ai_model', id, { status: dto.status, active: dto.active });
    return rows[0];
  }

  async updatePolicy(user: AuthenticatedUser, id: string, dto: UpdatePolicyDto) {
    const rows = await this.repo.query<{ id: string }>(
      `update platform.ai_policies
       set enabled=$2, rules=$3::jsonb, updated_at=now(), row_version=row_version+1
       where id=$1 returning id, code, name, enabled, rules`,
      [id, dto.enabled, JSON.stringify(dto.rules)]
    );
    if (!rows.length) throw new NotFoundException('AI policy not found');
    await this.audit(user, 'platform.ai_policy.updated', 'ai_policy', id, { enabled: dto.enabled });
    return rows[0];
  }

  async resolveReview(user: AuthenticatedUser, id: string, dto: ResolveReviewDto) {
    const rows = await this.repo.query<{ id: string }>(
      `update platform.ai_review_queue
       set status=$2, resolved_by=$3, resolved_at=now(), updated_at=now()
       where id=$1 and status in ('open','reviewing')
       returning id, status, resolved_at`,
      [id, dto.status, user.userId]
    );
    if (!rows.length) throw new NotFoundException('AI review item not found');
    await this.audit(user, 'platform.ai_review.resolved', 'ai_review', id, { status: dto.status });
    return rows[0];
  }

  async requestExport(user: AuthenticatedUser, dto: RequestExportDto) {
    const rows = await this.repo.query<{ id: string; status: string }>(
      `insert into platform.data_exports
        (requested_by, institution_id, export_type, format, filter_spec, status)
       values ($1,$2,$3,$4,$5::jsonb,'queued')
       returning id,status`,
      [user.userId, dto.institutionId ?? null, dto.exportType, dto.format, JSON.stringify(dto.filterSpec)]
    );
    await this.audit(user, 'platform.data_export.requested', 'data_export', rows[0]?.id ?? null, {
      exportType: dto.exportType,
      format: dto.format
    });
    return rows[0];
  }

  async updateRetention(user: AuthenticatedUser, id: string, dto: UpdateRetentionDto) {
    const rows = await this.repo.query<{ id: string }>(
      `update platform.retention_policies
       set retention_days=$2,
           archive_after_days=$3,
           legal_hold=$4,
           updated_by=$5,
           updated_at=now(),
           row_version=row_version+1
       where id=$1
       returning id, domain, retention_days, archive_after_days, legal_hold`,
      [id, dto.retentionDays, dto.archiveAfterDays ?? null, dto.legalHold, user.userId]
    );
    if (!rows.length) throw new NotFoundException('Retention policy not found');
    await this.audit(user, 'platform.retention.updated', 'retention_policy', id, {
      retentionDays: dto.retentionDays,
      legalHold: dto.legalHold
    });
    return rows[0];
  }

  /**
   * Corrected against the real core.audit_log schema (0001_foundation.sql):
   * actor_id / entity_type / entity_id / after -- the uploaded code
   * assumed actor_user_id / resource_type / resource_id / metadata,
   * none of which exist on the real table. As written, every single
   * mutating method in this service would have thrown a SQL error
   * the moment it tried to audit-log, since audit() is called
   * unconditionally after every successful mutation above.
   */
  private async audit(
    user: AuthenticatedUser,
    action: string,
    entityType: string,
    entityId: string | null,
    after: Record<string, unknown>
  ) {
    await this.repo.query(
      `insert into core.audit_log(actor_id, action, entity_type, entity_id, after)
       values($1,$2,$3,$4,$5::jsonb)`,
      [user.userId, action, entityType, entityId, JSON.stringify(after)]
    );
  }
}

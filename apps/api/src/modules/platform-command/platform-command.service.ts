import { NotFoundException } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import type {
  CreateComplianceRequestDto,
  CreateIncidentDto,
  RequestRestoreDto,
  UpdateIncidentDto
} from './platform-command.dto';
import { PlatformCommandRepository } from './platform-command.repository';

@Injectable()
export class PlatformCommandService {
  constructor(private readonly repo: PlatformCommandRepository) {}

  serviceHealth() {
    return this.repo.query(
      `select distinct on (service_code, environment)
              id, service_code, environment, region, status, latency_ms, error_rate,
              cpu_percent, memory_percent, version, observed_at
       from platform.service_health
       order by service_code, environment, observed_at desc`
    );
  }

  incidents() {
    return this.repo.query(
      `select id, incident_number, title, severity, status, affected_services,
              summary, customer_impact, started_at, identified_at, resolved_at,
              commander_user_id
       from platform.incidents
       order by case severity when 'sev1' then 1 when 'sev2' then 2 when 'sev3' then 3 else 4 end,
                started_at desc
       limit 250`
    );
  }

  complianceRequests() {
    return this.repo.query(
      `select id, request_number, request_type, subject_type, subject_reference,
              institution_id, status, priority, due_at, assigned_to, created_at, completed_at
       from platform.compliance_requests
       order by case priority when 'urgent' then 1 when 'high' then 2 else 3 end,
                due_at nulls last, created_at desc
       limit 250`
    );
  }

  backups() {
    return this.repo.query(
      `select id, system_code, backup_type, status, region, started_at, completed_at,
              expires_at, size_bytes, checksum
       from platform.backup_snapshots
       order by started_at desc limit 250`
    );
  }

  restoreRequests() {
    return this.repo.query(
      `select id, backup_snapshot_id, requested_by, approved_by, environment, status,
              reason, requested_at, approved_at, started_at, completed_at
       from platform.restore_requests
       order by requested_at desc limit 250`
    );
  }

  deployments() {
    return this.repo.query(
      `select id, service_code, environment, version, commit_sha, status,
              deployed_by, region, started_at, completed_at
       from platform.deployments
       order by started_at desc limit 250`
    );
  }

  readiness() {
    return this.repo.query(
      `select distinct on (check_code)
              id, check_code, category, status, details, checked_at, checked_by
       from platform.production_readiness_checks
       order by check_code, checked_at desc`
    );
  }

  async createIncident(user: AuthenticatedUser, dto: CreateIncidentDto) {
    const number = `INC-${Date.now()}`;
    const rows = await this.repo.query<{ id: string; incident_number: string }>(
      `insert into platform.incidents
        (incident_number, title, severity, affected_services, summary,
         customer_impact, created_by, commander_user_id)
       values($1,$2,$3,$4::jsonb,$5,$6,$7,$7)
       returning id, incident_number`,
      [number, dto.title, dto.severity, JSON.stringify(dto.affectedServices), dto.summary ?? null, dto.customerImpact ?? null, user.userId]
    );
    await this.audit(user, 'platform.incident.created', 'incident', rows[0]?.id ?? null, {
      severity: dto.severity,
      title: dto.title
    });
    return rows[0];
  }

  async updateIncident(user: AuthenticatedUser, id: string, dto: UpdateIncidentDto) {
    const rows = await this.repo.query<{
      id: string;
      incident_number: string;
      status: string;
      identified_at: string | null;
      resolved_at: string | null;
      closed_at: string | null;
    }>(
      `update platform.incidents
       set status=$2,
           root_cause=coalesce($3,root_cause),
           identified_at=case when $2='identified' and identified_at is null then now() else identified_at end,
           resolved_at=case when $2='resolved' and resolved_at is null then now() else resolved_at end,
           closed_at=case when $2='closed' and closed_at is null then now() else closed_at end,
           updated_at=now()
       where id=$1
       returning id, incident_number, status, identified_at, resolved_at, closed_at`,
      [id, dto.status, dto.rootCause ?? null]
    );
    if (!rows.length) throw new NotFoundException('Incident not found');
    await this.audit(user, 'platform.incident.status_changed', 'incident', id, { status: dto.status });
    return rows[0];
  }

  async createComplianceRequest(user: AuthenticatedUser, dto: CreateComplianceRequestDto) {
    const number = `DPR-${Date.now()}`;
    const rows = await this.repo.query<{ id: string; request_number: string }>(
      `insert into platform.compliance_requests
        (request_number, request_type, subject_type, subject_reference, institution_id,
         priority, due_at, notes)
       values($1,$2,$3,$4,$5,$6,$7,$8)
       returning id, request_number`,
      [
        number,
        dto.requestType,
        dto.subjectType,
        dto.subjectReference,
        dto.institutionId ?? null,
        dto.priority,
        dto.dueAt ?? null,
        dto.notes ?? null
      ]
    );
    await this.audit(user, 'platform.compliance_request.created', 'compliance_request', rows[0]?.id ?? null, {
      requestType: dto.requestType
    });
    return rows[0];
  }

  async requestRestore(user: AuthenticatedUser, dto: RequestRestoreDto) {
    const rows = await this.repo.query<{ id: string; status: string }>(
      `insert into platform.restore_requests
        (backup_snapshot_id, requested_by, environment, status, reason)
       values($1,$2,$3,'pending_approval',$4)
       returning id,status`,
      [dto.backupSnapshotId, user.userId, dto.environment, dto.reason]
    );
    await this.audit(user, 'platform.restore.requested', 'restore_request', rows[0]?.id ?? null, {
      environment: dto.environment,
      snapshotId: dto.backupSnapshotId
    });
    return rows[0];
  }

  async approveRestore(user: AuthenticatedUser, id: string) {
    const rows = await this.repo.query<{ id: string; status: string; approved_at: string }>(
      // requested_by <> $2: the same maker-checker separation as
      // broadcast approval in platform-business -- whoever requested
      // a production database restore cannot also be the one who
      // approves it. Without this, "request then approve" is not a
      // two-person control at all, just one person clicking twice.
      `update platform.restore_requests
       set status='approved', approved_by=$2, approved_at=now()
       where id=$1 and status='pending_approval' and requested_by <> $2
       returning id,status,approved_at`,
      [id, user.userId]
    );
    if (!rows.length) {
      throw new NotFoundException(
        'Restore request not found, not awaiting approval, or you are the same person who requested it -- restores require a different approver than their requester'
      );
    }
    await this.audit(user, 'platform.restore.approved', 'restore_request', id, {});
    return rows[0];
  }

  /**
   * Corrected against the real core.audit_log schema
   * (0001_foundation.sql): actor_id / entity_type / entity_id / after
   * -- the uploaded code assumed actor_user_id / resource_type /
   * resource_id / metadata, none of which exist on the real table.
   * Same bug and same fix as platform-intelligence's audit() helper.
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

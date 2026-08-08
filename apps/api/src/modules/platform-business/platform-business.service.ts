import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../core/auth/auth.types';
import type { CreateBroadcastDto } from './platform-business.dto';
import { PlatformBusinessRepository } from './platform-business.repository';

@Injectable()
export class PlatformBusinessService {
  constructor(private readonly repo: PlatformBusinessRepository) {}

  plans() {
    return this.repo.query(
      `select id,code,name,billing_interval,currency,price_minor,active,features from platform.plans order by name`
    );
  }

  subscriptions() {
    return this.repo.query(
      `select s.*,p.code plan_code,p.name plan_name from platform.subscriptions s join platform.plans p on p.id=s.plan_id order by s.created_at desc limit 250`
    );
  }

  invoices() {
    return this.repo.query(`select * from platform.billing_invoices order by created_at desc limit 250`);
  }

  payments() {
    return this.repo.query(
      `select id,institution_id,invoice_id,provider,provider_reference,currency,amount_minor,status,failure_code,occurred_at from platform.payment_transactions order by occurred_at desc limit 250`
    );
  }

  integrations() {
    return this.repo.query(
      `select id,code,display_name,category,environment,status,enabled,last_success_at,last_failure_at,last_error_code,latency_ms from platform.integration_config order by category,display_name`
    );
  }

  broadcasts() {
    return this.repo.query(
      `select id,title,channel,audience_type,audience_filter,status,created_by,approved_by,approved_at,published_at,scheduled_for,created_at from platform.broadcasts order by created_at desc limit 250`
    );
  }

  async createBroadcast(user: AuthenticatedUser, dto: CreateBroadcastDto) {
    const rows = await this.repo.query<{ id: string; status: string }>(
      `insert into platform.broadcasts(title,body,channel,audience_type,audience_filter,status,created_by) values($1,$2,$3,$4,$5::jsonb,'pending_approval',$6) returning id,status`,
      [dto.title, dto.body, dto.channel, dto.audienceType, JSON.stringify(dto.audienceFilter), user.userId]
    );
    return rows[0];
  }

  async approveBroadcast(user: AuthenticatedUser, id: string) {
    const rows = await this.repo.query<{ id: string; status: string }>(
      // created_by <> $2 enforces maker-checker separation: whoever
      // drafted a national broadcast cannot also be the one who
      // approves it. This is the one WHERE clause standing between
      // "requires two people to review" and "requires one person to
      // click twice" for a message that can reach every school,
      // teacher, parent, and student on the platform.
      `update platform.broadcasts set status='approved',approved_by=$2,approved_at=now(),updated_at=now()
       where id=$1 and status='pending_approval' and created_by <> $2
       returning id,status`,
      [id, user.userId]
    );
    if (!rows.length) {
      throw new NotFoundException(
        'Broadcast not found, not awaiting approval, or you are the same person who created it -- broadcasts require a different approver than their creator'
      );
    }
    return rows[0];
  }

  async publishBroadcast(user: AuthenticatedUser, id: string) {
    // user isn't stored anywhere here -- platform.broadcasts has no
    // published_by column -- but the parameter stays required on this
    // method (and @Roles-gated on the controller) so publishing still
    // demands a real, authenticated platform_admin, not because the
    // identity itself needs recording for this particular step.
    const rows = await this.repo.query<{ id: string; status: string }>(
      `update platform.broadcasts set status='published',published_at=now(),updated_at=now() where id=$1 and status='approved' returning id,status`,
      [id]
    );
    if (!rows.length) throw new BadRequestException('Broadcast must be approved before publication');
    return rows[0];
  }
}

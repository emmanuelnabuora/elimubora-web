import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { MembershipRole } from '../auth/auth.types';
import { PasswordService } from '../auth/password.service';
import { AuditService } from '../audit/audit.service';
import { DatabaseService } from '../database/database.service';

/**
 * Core-platform primitive: creates a bare core.users + core.memberships
 * pair for a "shadow" account — a system identity that exists (for FK
 * integrity, enrollment, gradebooks) before or without the person ever
 * logging in. This matters most for young CBC learners (PP1–G3), who
 * often never authenticate directly; a guardian or teacher acts on
 * their behalf. The account gets an unusable random password and a
 * clearly-marked placeholder email; issuing real login credentials
 * (or linking a guardian account) is a separate, later flow — not
 * built in this sprint.
 *
 * This lives in core (not the identity module) specifically so other
 * domain modules — SIS enrolling a student, a future bulk staff
 * import — can provision a system identity without importing the
 * identity module, which the module-boundary rule forbids.
 */
@Injectable()
export class UserProvisioningService {
  constructor(
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
    private readonly passwords: PasswordService
  ) {}

  async provisionShadowMember(input: {
    tenantId: string;
    fullName: string;
    role: MembershipRole;
  }): Promise<{ userId: string; placeholderEmail: string }> {
    const userId = randomUUID();
    const placeholderEmail = `shadow.${userId}@no-login.elimubora.internal`;
    const unusablePassword = await this.passwords.hash(randomBytes(32).toString('hex'));

    await this.db.withContext({ tenantId: input.tenantId }, async (client) => {
      await client.query(
        `INSERT INTO core.users (id, email, full_name, password_hash)
         VALUES ($1, $2, $3, $4)`,
        [userId, placeholderEmail, input.fullName, unusablePassword]
      );
      await client.query(
        `INSERT INTO core.memberships (user_id, tenant_id, role)
         VALUES ($1, core.current_tenant_id(), $2)`,
        [userId, input.role]
      );
      await this.audit.record(client, {
        action: 'user.provisioned',
        entityType: 'user',
        entityId: userId,
        after: { role: input.role, shadow: true }
      });
    });

    return { userId, placeholderEmail };
  }
}

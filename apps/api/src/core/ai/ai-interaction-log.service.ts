import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { AiCompletionRequest } from './ai-provider.port';

/**
 * Logs every AI interaction platform-wide, analogous to AuditService
 * for state changes. Any domain module may call this — it lives in
 * core specifically so no module needs to import another to log an
 * AI interaction its own feature triggered. Deliberately excluded
 * from the sync/pull feed (migration 0015): interaction content may
 * include a specific child's question, and this is a server-side
 * audit trail, not a synced client-cacheable record.
 */
@Injectable()
export class AiInteractionLogService {
  constructor(private readonly db: DatabaseService) {}

  async record(input: {
    userId: string;
    feature: AiCompletionRequest['feature'];
    context: Record<string, unknown>;
    promptSummary: string;
    responseSummary: string;
  }): Promise<void> {
    await this.db.withTenantTransaction(async (client) => {
      await client.query(
        `INSERT INTO ai.interactions
           (tenant_id, user_id, feature, context, prompt_summary, response_summary)
         VALUES (core.current_tenant_id(), $1, $2, $3::jsonb, $4, $5)`,
        [
          input.userId,
          input.feature,
          JSON.stringify(input.context),
          input.promptSummary.slice(0, 2000),
          input.responseSummary.slice(0, 2000)
        ]
      );
    });
  }

  async listForUser(
    userId: string,
    limit = 50
  ): Promise<
    Array<{
      feature: string;
      context: Record<string, unknown>;
      promptSummary: string;
      responseSummary: string;
      createdAt: string;
    }>
  > {
    return this.db.withTenantTransaction(async (client) => {
      const { rows } = await client.query<{
        feature: string;
        context: Record<string, unknown>;
        prompt_summary: string;
        response_summary: string;
        created_at: Date;
      }>(
        `SELECT feature, context, prompt_summary, response_summary, created_at
           FROM ai.interactions
          WHERE user_id = $1 AND tenant_id = core.current_tenant_id()
          ORDER BY created_at DESC
          LIMIT $2`,
        [userId, limit]
      );
      return rows.map((r) => ({
        feature: r.feature,
        context: r.context,
        promptSummary: r.prompt_summary,
        responseSummary: r.response_summary,
        createdAt: r.created_at.toISOString()
      }));
    });
  }
}

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';

@Injectable()
export class PlatformIntelligenceRepository {
  constructor(private readonly db: DatabaseService) {}

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    const { rows } = await this.db.query<T>(sql, params);
    return rows;
  }
}

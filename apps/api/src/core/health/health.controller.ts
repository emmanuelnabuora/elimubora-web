import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { DatabaseService } from '../database/database.service';

interface HealthReport {
  status: 'ok';
  service: 'elimubora-api';
  version: string;
  db: { status: 'ok'; latencyMs: number };
  timestamp: string;
}

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Liveness + readiness in one for Sprint 1; split into /health/live
   * and /health/ready when Kubernetes enters the picture.
   */
  @Get()
  async check(): Promise<HealthReport> {
    let latencyMs: number;
    try {
      latencyMs = await this.db.ping();
    } catch {
      throw new ServiceUnavailableException('Database unreachable');
    }
    return {
      status: 'ok',
      service: 'elimubora-api',
      version: process.env.npm_package_version ?? '0.1.0',
      db: { status: 'ok', latencyMs: Math.round(latencyMs * 100) / 100 },
      timestamp: new Date().toISOString()
    };
  }
}

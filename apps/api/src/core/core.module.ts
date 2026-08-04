import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, minutes } from '@nestjs/throttler';
import { APP_CONFIG, loadConfig } from '../config/configuration';
import { AuditService } from './audit/audit.service';
import { AuditController } from './audit/audit.controller';
import { DatabaseService } from './database/database.service';
import { WorkerDatabaseService } from './database/worker-database.service';
import { HealthController } from './health/health.controller';
import {
  DevLogNotificationChannel,
  NOTIFICATION_CHANNEL
} from './notifications/notification';
import { EVENT_PUBLISHER, InProcessEventPublisher } from './outbox/event-publisher';
import { OutboxRelay } from './outbox/outbox.relay';
import { OutboxService } from './outbox/outbox.service';
import { SyncController } from './sync/sync.controller';
import { SyncService } from './sync/sync.service';
import { PasswordService } from './auth/password.service';
import { UserProvisioningService } from './identity/user-provisioning.service';
import { AiController } from './ai/ai.controller';
import { AiInteractionLogService } from './ai/ai-interaction-log.service';
import { AI_PROVIDER } from './ai/ai-provider.port';
import { SandboxAiProvider } from './ai/sandbox-ai.provider';
import { ManualReconciliationGateway } from './payments/manual-reconciliation.gateway';
import { PAYMENT_GATEWAY } from './payments/payment-gateway.port';
import { SandboxPushProvider } from './push/sandbox-push.provider';
import { PUSH_PROVIDER } from './push/push-provider.port';
import { LocalFileStorageProvider } from './storage/local-file-storage.provider';
import { FILE_STORAGE_PROVIDER } from './storage/file-storage.port';

/**
 * Core platform services, available everywhere without imports.
 * Domain modules depend on these — never on each other.
 */
@Global()
@Module({
  imports: [
    // A single named 'default' throttler: 100 requests/minute per
    // client IP. Auth endpoints override this with a much stricter
    // limit via @Throttle() (see auth.controller.ts) — this default
    // exists to protect every other endpoint, which had genuinely no
    // rate limiting at all before this. skipIf disables throttling
    // entirely in tests — found via a real regression: three existing
    // integration test files legitimately register/log in more than
    // 5 users each within a single app instance as realistic test
    // setup (a real school has many staff and students), which the
    // strict auth throttle correctly treats as abuse in production
    // but incorrectly treats as abuse here. This is a test-environment
    // exemption, not a weakened production limit.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: minutes(1),
        limit: 100,
        skipIf: () => process.env.NODE_ENV === 'test'
      }
    ])
  ],
  controllers: [HealthController, SyncController, AiController, AuditController],
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig(process.env) },
    { provide: EVENT_PUBLISHER, useClass: InProcessEventPublisher },
    { provide: NOTIFICATION_CHANNEL, useClass: DevLogNotificationChannel },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    DatabaseService,
    WorkerDatabaseService,
    AuditService,
    OutboxService,
    OutboxRelay,
    SyncService,
    PasswordService,
    UserProvisioningService,
    { provide: PAYMENT_GATEWAY, useClass: ManualReconciliationGateway },
    { provide: AI_PROVIDER, useClass: SandboxAiProvider },
    AiInteractionLogService,
    { provide: PUSH_PROVIDER, useClass: SandboxPushProvider },
    { provide: FILE_STORAGE_PROVIDER, useClass: LocalFileStorageProvider }
  ],
  exports: [
    APP_CONFIG,
    EVENT_PUBLISHER,
    NOTIFICATION_CHANNEL,
    DatabaseService,
    WorkerDatabaseService,
    AuditService,
    OutboxService,
    SyncService,
    PasswordService,
    UserProvisioningService,
    PAYMENT_GATEWAY,
    AI_PROVIDER,
    AiInteractionLogService,
    PUSH_PROVIDER,
    FILE_STORAGE_PROVIDER
  ]
})
export class CoreModule {}

import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from '../config/configuration';
import { AuditService } from './audit/audit.service';
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

/**
 * Core platform services, available everywhere without imports.
 * Domain modules depend on these — never on each other.
 */
@Global()
@Module({
  controllers: [HealthController, SyncController, AiController],
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig(process.env) },
    { provide: EVENT_PUBLISHER, useClass: InProcessEventPublisher },
    { provide: NOTIFICATION_CHANNEL, useClass: DevLogNotificationChannel },
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
    AiInteractionLogService
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
    AiInteractionLogService
  ]
})
export class CoreModule {}

import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { applyGlobalAppConfig } from './bootstrap';
import { loadConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const config = loadConfig(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.enableShutdownHooks();
  applyGlobalAppConfig(app, config);

  await app.listen(config.port);
  new Logger('Bootstrap').log(`ElimuBora API listening on :${config.port} (${config.nodeEnv})`);
}

void bootstrap();

import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const config = loadConfig(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  );
  app.enableShutdownHooks();
  app.setGlobalPrefix('v1', { exclude: ['health'] });

  await app.listen(config.port);
  new Logger('Bootstrap').log(`ElimuBora API listening on :${config.port} (${config.nodeEnv})`);
}

void bootstrap();

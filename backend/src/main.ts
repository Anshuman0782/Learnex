import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import * as path from 'node:path';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Secure HTTP headers. crossOriginResourcePolicy is relaxed so the RN app can
  // load uploaded images/videos served from this origin.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // Serve uploaded files at /uploads (outside the /api/v1 prefix).
  const uploadsDir = path.resolve(config.get<string>('UPLOADS_DIR') ?? 'uploads');
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  // All routes live under /api/v1 so we can version the API later without breakage.
  app.setGlobalPrefix('api/v1');

  // Global input validation for every incoming request:
  //  - whitelist: strip properties not declared in the DTO
  //  - forbidNonWhitelisted: reject requests that send unknown properties
  //  - transform: coerce payloads into their DTO class instances/types
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS: the React Native app calls this API. Tightened to real origins in Phase 9.
  app.enableCors({ origin: true, credentials: true });

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  logger.log(`LERNEX API running at http://localhost:${port}/api/v1`);
}

await bootstrap();

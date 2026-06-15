// Load .env before any other import so modules evaluated at load time (e.g. the
// better-auth instance, which reads process.env) see the configured values.
import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap(): Promise<void> {
  // Disable the global body parser so we can skip it for the better-auth handler,
  // which must read the raw request stream itself.
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService<AppConfig, true>);

  // Apply JSON/urlencoded parsing to everything EXCEPT the better-auth routes.
  app.use((req: { originalUrl: string }, res: unknown, next: () => void) => {
    if (req.originalUrl.startsWith('/api/auth')) {
      return next();
    }
    return json()(req as never, res as never, () =>
      urlencoded({ extended: true })(req as never, res as never, next),
    );
  });

  // Security headers. CSP is disabled so the Swagger UI assets at /docs load.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.enableCors({
    origin: config.get('corsOrigin', { infer: true }),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.enableShutdownHooks();

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Song-Sharing Platform API')
    .setDescription('Backend API connecting songwriter managers with their songwriters')
    .setVersion('1.0')
    .addCookieAuth('better-auth.session_token')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get('port', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`API running on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();

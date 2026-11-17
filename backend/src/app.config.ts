import cookieParser from 'cookie-parser';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { getAllowedFrontendOrigins } from './auth/auth.constants.js';

export function configureApp(app: INestApplication): void {
  const allowedOrigins = getAllowedFrontendOrigins();
  if (process.env['NODE_ENV'] === 'production' && allowedOrigins.length === 0) {
    throw new Error('FRONTEND_ORIGINS must be configured in production.');
  }

  if (process.env['NODE_ENV'] === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}

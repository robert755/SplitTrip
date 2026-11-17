import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { getAllowedFrontendOrigins } from '../auth.constants.js';

@Injectable()
export class AuthOriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const origin = request.headers.origin;
    const allowedOrigins = getAllowedFrontendOrigins();

    if (
      (origin && allowedOrigins.includes(origin)) ||
      (!origin && process.env['NODE_ENV'] !== 'production')
    ) {
      return true;
    }

    throw new ForbiddenException('Request origin is not allowed.');
  }
}

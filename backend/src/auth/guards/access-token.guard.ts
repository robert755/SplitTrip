import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getAccessTokenSecret } from '../auth.constants.js';
import type {
  AccessTokenPayload,
  AuthenticatedRequest,
} from '../auth.types.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('A valid access token is required.');
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
          secret: getAccessTokenSecret(),
        });
      if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
        throw new UnauthorizedException('Invalid access token.');
      }

      request.user = { id: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}

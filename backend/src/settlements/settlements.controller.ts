import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guard.js';
import {
  SettlementsService,
  type SettlementsResponse,
} from './settlements.service.js';

@Controller('trips/:tripId/settlements')
@UseGuards(AccessTokenGuard)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  calculate(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<SettlementsResponse> {
    return this.settlementsService.calculate(tripId, request.user.id);
  }
}

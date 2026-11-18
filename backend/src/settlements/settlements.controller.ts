import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guard.js';
import {
  SettlementsService,
  type SettlementPaymentResponse,
  type SettlementsResponse,
} from './settlements.service.js';
import { UpdateSettlementTransferDto } from './dto/update-settlement-transfer.dto.js';

@Controller('trips/:tripId/settlements')
@UseGuards(AccessTokenGuard)
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get()
  findLatest(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<SettlementsResponse | null> {
    return this.settlementsService.findLatest(tripId, request.user.id);
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  calculate(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<SettlementsResponse> {
    return this.settlementsService.calculate(tripId, request.user.id);
  }

  @Patch(':transferId')
  updateTransfer(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('transferId', ParseUUIDPipe) transferId: string,
    @Body() dto: UpdateSettlementTransferDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SettlementPaymentResponse> {
    return this.settlementsService.setTransferPaid(
      tripId,
      transferId,
      request.user.id,
      dto.isPaid,
    );
  }
}

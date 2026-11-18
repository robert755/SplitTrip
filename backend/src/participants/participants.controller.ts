import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { AccessTokenGuard } from '../auth/guards/access-token.guard.js';
import { CreateParticipantDto } from './create-participant.dto.js';
import {
  ParticipantsService,
  type ParticipantResponse,
} from './participants.service.js';

@Controller('trips/:tripId/participants')
@UseGuards(AccessTokenGuard)
export class ParticipantsController {
  constructor(private readonly participantsService: ParticipantsService) {}

  @Post()
  create(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Body() dto: CreateParticipantDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ParticipantResponse> {
    return this.participantsService.create(tripId, request.user.id, dto);
  }

  @Get()
  findAll(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ParticipantResponse[]> {
    return this.participantsService.findAll(tripId, request.user.id);
  }

  @Delete(':participantId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.participantsService.remove(
      tripId,
      participantId,
      request.user.id,
    );
  }
}

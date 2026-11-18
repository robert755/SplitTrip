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
import { CreateTripDto } from './create-trip.dto.js';
import { TripsService, type TripResponse } from './trips.service.js';

@Controller('trips')
@UseGuards(AccessTokenGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  create(
    @Body() createTripDto: CreateTripDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<TripResponse> {
    return this.tripsService.create(createTripDto, request.user.id);
  }

  @Get()
  findAll(@Req() request: AuthenticatedRequest): Promise<TripResponse[]> {
    return this.tripsService.findAll(request.user.id);
  }

  @Delete(':tripId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    return this.tripsService.remove(tripId, request.user.id);
  }
}

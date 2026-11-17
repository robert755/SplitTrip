import { Body, Controller, Get, Post } from '@nestjs/common';
import type { Trip } from '../generated/prisma/client.js';
import { CreateTripDto } from './create-trip.dto.js';
import { TripsService } from './trips.service.js';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  create(@Body() createTripDto: CreateTripDto): Promise<Trip> {
    return this.tripsService.create(createTripDto);
  }

  @Get()
  findAll(): Promise<Trip[]> {
    return this.tripsService.findAll();
  }
}

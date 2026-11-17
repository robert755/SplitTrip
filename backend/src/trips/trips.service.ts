import { Injectable } from '@nestjs/common';
import type { Trip } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTripDto } from './create-trip.dto.js';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createTripDto: CreateTripDto): Promise<Trip> {
    return this.prisma.trip.create({
      data: { name: createTripDto.name.trim() },
    });
  }

  findAll(): Promise<Trip[]> {
    return this.prisma.trip.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}

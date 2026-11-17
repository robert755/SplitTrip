import { Injectable } from '@nestjs/common';
import { Prisma, type Trip } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTripDto } from './create-trip.dto.js';

export type TripResponse = Pick<Trip, 'id' | 'name' | 'currency' | 'createdAt'>;

const tripSelect = {
  id: true,
  name: true,
  currency: true,
  createdAt: true,
} satisfies Prisma.TripSelect;

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  create(createTripDto: CreateTripDto, ownerId: string): Promise<TripResponse> {
    return this.prisma.trip.create({
      data: { name: createTripDto.name.trim(), ownerId },
      select: tripSelect,
    });
  }

  findAll(ownerId: string): Promise<TripResponse[]> {
    return this.prisma.trip.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      select: tripSelect,
    });
  }
}

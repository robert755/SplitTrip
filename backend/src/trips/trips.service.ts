import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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

  @Cron(CronExpression.EVERY_HOUR)
  async deleteExpiredTrips(): Promise<void> {
    const expirationThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const expiredTrips = await this.prisma.trip.findMany({
      where: { createdAt: { lt: expirationThreshold } },
      select: { id: true },
    });

    if (expiredTrips.length === 0) {
      return;
    }

    const tripIds = expiredTrips.map((trip) => trip.id);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.expenseShare.deleteMany({
        where: { expense: { tripId: { in: tripIds } } },
      });
      await transaction.expense.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      await transaction.participant.deleteMany({
        where: { tripId: { in: tripIds } },
      });
      await transaction.trip.deleteMany({
        where: { id: { in: tripIds } },
      });
    });
  }

  create(createTripDto: CreateTripDto, ownerId: string): Promise<TripResponse> {
    return this.prisma.trip.create({
      data: { name: createTripDto.name.trim(), ownerId },
      select: tripSelect,
    });
  }

  async remove(tripId: string, ownerId: string): Promise<void> {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, ownerId },
      select: { id: true },
    });
    if (!trip) {
      throw new NotFoundException('Trip not found.');
    }

    await this.prisma.$transaction(
      async (transaction) => {
        await transaction.expenseShare.deleteMany({
          where: { expense: { tripId } },
        });
        await transaction.expense.deleteMany({ where: { tripId } });
        await transaction.participant.deleteMany({ where: { tripId } });
        await transaction.trip.delete({ where: { id: tripId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async findAll(ownerId: string): Promise<TripResponse[]> {
    await this.deleteExpiredTrips();
    return this.prisma.trip.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      select: tripSelect,
    });
  }
}

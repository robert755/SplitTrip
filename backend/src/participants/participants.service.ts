import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Participant } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateParticipantDto } from './create-participant.dto.js';

export type ParticipantResponse = Pick<Participant, 'id' | 'name'>;

const participantSelect = {
  id: true,
  name: true,
} satisfies Prisma.ParticipantSelect;

@Injectable()
export class ParticipantsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    tripId: string,
    ownerId: string,
    dto: CreateParticipantDto,
  ): Promise<ParticipantResponse> {
    await this.ensureTripIsOwnedByUser(tripId, ownerId);

    const existingParticipants = await this.prisma.participant.findMany({
      where: { tripId },
      select: { name: true },
    });
    const normalizedName = dto.name.trim().toLocaleLowerCase();
    if (
      existingParticipants.some(
        (participant) =>
          participant.name.trim().toLocaleLowerCase() === normalizedName,
      )
    ) {
      throw new BadRequestException(
        'A participant with this name already exists in this trip.',
      );
    }

    return this.prisma.participant.create({
      data: { tripId, name: dto.name },
      select: participantSelect,
    });
  }

  async findAll(
    tripId: string,
    ownerId: string,
  ): Promise<ParticipantResponse[]> {
    await this.ensureTripIsOwnedByUser(tripId, ownerId);

    return this.prisma.participant.findMany({
      where: { tripId },
      orderBy: { name: 'asc' },
      select: participantSelect,
    });
  }

  private async ensureTripIsOwnedByUser(
    tripId: string,
    ownerId: string,
  ): Promise<void> {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, ownerId },
      select: { id: true },
    });

    if (!trip) {
      throw new NotFoundException('Trip not found.');
    }
  }
}

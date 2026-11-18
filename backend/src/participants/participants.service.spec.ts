import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ParticipantsService } from './participants.service.js';

describe('ParticipantsService.remove', () => {
  const tripId = 'c3f6b6b8-e238-4ac8-b970-6e507fa42942';
  const participantId = 'ed8c3129-609f-40f3-aa94-1b32ea27f1db';
  const ownerId = '4a8f728e-bf6d-44db-a544-7c35d3ef9bf6';

  function createService(
    participant: {
      id: string;
      _count: { paidExpenses: number; shares: number };
    } | null,
  ) {
    const prismaMock = {
      trip: { findFirst: vi.fn().mockResolvedValue({ id: tripId }) },
      participant: {
        findFirst: vi.fn().mockResolvedValue(participant),
        delete: vi.fn().mockResolvedValue({ id: participantId }),
      },
    };
    return {
      service: new ParticipantsService(prismaMock as unknown as PrismaService),
      prismaMock,
    };
  }

  it('deletes a participant who is not used in any expenses', async () => {
    const { service, prismaMock } = createService({
      id: participantId,
      _count: { paidExpenses: 0, shares: 0 },
    });

    await service.remove(tripId, participantId, ownerId);

    expect(prismaMock.participant.delete).toHaveBeenCalledWith({
      where: { id: participantId },
    });
  });

  it.each([
    { paidExpenses: 1, shares: 0 },
    { paidExpenses: 0, shares: 1 },
  ])(
    'blocks deletion when the participant has expense history: $paidExpenses paid, $shares shares',
    async ({ paidExpenses, shares }) => {
      const { service, prismaMock } = createService({
        id: participantId,
        _count: { paidExpenses, shares },
      });

      await expect(
        service.remove(tripId, participantId, ownerId),
      ).rejects.toThrow(BadRequestException);
      expect(prismaMock.participant.delete).not.toHaveBeenCalled();
    },
  );
});

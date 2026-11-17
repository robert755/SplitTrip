import {
  InternalServerErrorException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  calculateMinimumTransfers,
  MAX_EXACT_SETTLEMENT_PARTICIPANTS,
} from './minimum-transfers.js';

const settlementTripSelect = {
  id: true,
  currency: true,
  participants: {
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  },
  expenses: {
    select: {
      amount: true,
      payerId: true,
      shares: { select: { participantId: true, amount: true } },
    },
  },
} satisfies Prisma.TripSelect;

export interface SettlementsResponse {
  currency: string;
  balances: Array<{
    participantId: string;
    name: string;
    balance: string;
  }>;
  settlements: Array<{
    from: { participantId: string; name: string };
    to: { participantId: string; name: string };
    amount: string;
  }>;
  transferCount: number;
}

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(
    tripId: string,
    ownerId: string,
  ): Promise<SettlementsResponse> {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, ownerId },
      select: settlementTripSelect,
    });

    if (!trip) {
      throw new NotFoundException('Trip not found.');
    }

    const balances = new Map(
      trip.participants.map((participant) => [
        participant.id,
        { participantId: participant.id, name: participant.name, balance: 0n },
      ]),
    );

    for (const expense of trip.expenses) {
      const total = this.toCents(expense.amount);
      const payer = balances.get(expense.payerId);
      if (total <= 0n || !payer) {
        throw new InternalServerErrorException(
          'The trip contains invalid expense data.',
        );
      }
      payer.balance += total;

      let sharesTotal = 0n;
      for (const share of expense.shares) {
        const participant = balances.get(share.participantId);
        const shareAmount = this.toCents(share.amount);
        if (shareAmount <= 0n || !participant) {
          throw new InternalServerErrorException(
            'The trip contains invalid expense shares.',
          );
        }
        participant.balance -= shareAmount;
        sharesTotal += shareAmount;
      }

      if (sharesTotal !== total) {
        throw new InternalServerErrorException(
          'The expense shares do not match the recorded expense total.',
        );
      }
    }

    const netBalances = [...balances.values()].map(
      ({ participantId, balance }) => ({ participantId, balance }),
    );
    const nonZeroBalanceCount = netBalances.filter(
      ({ balance }) => balance !== 0n,
    ).length;
    if (nonZeroBalanceCount > MAX_EXACT_SETTLEMENT_PARTICIPANTS) {
      throw new UnprocessableEntityException(
        `Exact settlement calculation supports at most ${MAX_EXACT_SETTLEMENT_PARTICIPANTS} participants with non-zero balances.`,
      );
    }

    const transfers = calculateMinimumTransfers(netBalances);
    const participantNames = new Map(
      trip.participants.map((participant) => [
        participant.id,
        participant.name,
      ]),
    );

    return {
      currency: trip.currency,
      balances: [...balances.values()].map((participant) => ({
        participantId: participant.participantId,
        name: participant.name,
        balance: this.formatCents(participant.balance),
      })),
      settlements: transfers.map((transfer) => ({
        from: {
          participantId: transfer.fromParticipantId,
          name: this.requireParticipantName(
            participantNames,
            transfer.fromParticipantId,
          ),
        },
        to: {
          participantId: transfer.toParticipantId,
          name: this.requireParticipantName(
            participantNames,
            transfer.toParticipantId,
          ),
        },
        amount: this.formatCents(transfer.amount),
      })),
      transferCount: transfers.length,
    };
  }

  private toCents(amount: Prisma.Decimal): bigint {
    const [whole, fraction] = amount.toFixed(2).split('.');
    return BigInt(whole) * 100n + BigInt(fraction);
  }

  private formatCents(amount: bigint): string {
    const sign = amount < 0n ? '-' : '';
    const absoluteAmount = amount < 0n ? -amount : amount;
    const whole = absoluteAmount / 100n;
    const fraction = (absoluteAmount % 100n).toString().padStart(2, '0');
    return `${sign}${whole}.${fraction}`;
  }

  private requireParticipantName(
    participantNames: Map<string, string>,
    participantId: string,
  ): string {
    const name = participantNames.get(participantId);
    if (name === undefined) {
      throw new InternalServerErrorException(
        'The trip contains an invalid participant balance.',
      );
    }
    return name;
  }
}

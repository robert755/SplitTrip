import {
  ConflictException,
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

const settlementPlanInclude = {
  balances: { orderBy: { participantName: 'asc' } },
  transfers: {
    orderBy: { sequence: 'asc' },
    include: {
      fromBalance: { select: { participantId: true, participantName: true } },
      toBalance: { select: { participantId: true, participantName: true } },
    },
  },
} satisfies Prisma.SettlementPlanInclude;

type SettlementPlanRecord = Prisma.SettlementPlanGetPayload<{
  include: typeof settlementPlanInclude;
}>;

export interface SettlementPaymentResponse {
  id: string;
  isPaid: boolean;
  paidAt: Date | null;
}

export interface SettlementsResponse {
  id: string;
  revision: number;
  isCurrent: boolean;
  createdAt: Date;
  invalidatedAt: Date | null;
  currency: string;
  balances: Array<{
    participantId: string;
    name: string;
    balance: string;
  }>;
  settlements: Array<{
    id: string;
    from: { participantId: string; name: string };
    to: { participantId: string; name: string };
    amount: string;
    isPaid: boolean;
    paidAt: Date | null;
  }>;
  transferCount: number;
}

@Injectable()
export class SettlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async findLatest(
    tripId: string,
    ownerId: string,
  ): Promise<SettlementsResponse | null> {
    await this.ensureTripIsOwnedByUser(tripId, ownerId);
    const plan = await this.prisma.settlementPlan.findFirst({
      where: { tripId },
      orderBy: { revision: 'desc' },
      include: settlementPlanInclude,
    });

    return plan ? this.toResponse(plan) : null;
  }

  async calculate(
    tripId: string,
    ownerId: string,
  ): Promise<SettlementsResponse> {
    await this.ensureTripIsOwnedByUser(tripId, ownerId);

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const currentPlan = await transaction.settlementPlan.findFirst({
            where: { tripId, isCurrent: true },
            include: settlementPlanInclude,
          });
          if (currentPlan) {
            return this.toResponse(currentPlan);
          }

          const trip = await transaction.trip.findUnique({
            where: { id: tripId },
            select: {
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
            },
          });

          if (!trip) {
            throw new NotFoundException('Trip not found.');
          }

          const balances = new Map(
            trip.participants.map((participant) => [
              participant.id,
              {
                participantId: participant.id,
                name: participant.name,
                balance: 0n,
              },
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
          const latestPlan = await transaction.settlementPlan.findFirst({
            where: { tripId },
            orderBy: { revision: 'desc' },
            select: { revision: true },
          });

          await transaction.settlementPlan.updateMany({
            where: { tripId, isCurrent: true },
            data: { isCurrent: false, invalidatedAt: new Date() },
          });

          const createdPlan = await transaction.settlementPlan.create({
            data: {
              tripId,
              revision: (latestPlan?.revision ?? 0) + 1,
              currency: trip.currency,
              transferCount: transfers.length,
              balances: {
                create: [...balances.values()].map((participant) => ({
                  participantId: participant.participantId,
                  participantName: participant.name,
                  balance: this.formatCents(participant.balance),
                })),
              },
            },
            include: {
              balances: { select: { id: true, participantId: true } },
            },
          });

          const balanceIds = new Map(
            createdPlan.balances.map((balance) => [
              balance.participantId,
              balance.id,
            ]),
          );
          if (transfers.length > 0) {
            await transaction.settlementTransfer.createMany({
              data: transfers.map((transfer, sequence) => ({
                planId: createdPlan.id,
                sequence,
                fromBalanceId: this.requireBalanceId(
                  balanceIds,
                  transfer.fromParticipantId,
                ),
                toBalanceId: this.requireBalanceId(
                  balanceIds,
                  transfer.toParticipantId,
                ),
                amount: this.formatCents(transfer.amount),
              })),
            });
          }

          const savedPlan = await transaction.settlementPlan.findUniqueOrThrow({
            where: { id: createdPlan.id },
            include: settlementPlanInclude,
          });
          return this.toResponse(savedPlan);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        const latestPlan = await this.prisma.settlementPlan.findFirst({
          where: { tripId, isCurrent: true },
          include: settlementPlanInclude,
        });
        if (latestPlan) {
          return this.toResponse(latestPlan);
        }
      }
      throw error;
    }
  }

  async setTransferPaid(
    tripId: string,
    transferId: string,
    ownerId: string,
    isPaid: boolean,
  ): Promise<SettlementPaymentResponse> {
    await this.ensureTripIsOwnedByUser(tripId, ownerId);

    return this.prisma.$transaction(
      async (transaction) => {
        const transfer = await transaction.settlementTransfer.findFirst({
          where: { id: transferId, plan: { is: { tripId } } },
          include: { plan: { select: { isCurrent: true } } },
        });

        if (!transfer) {
          throw new NotFoundException('Settlement transfer not found.');
        }
        if (!transfer.plan.isCurrent) {
          throw new ConflictException(
            'This settlement plan is outdated. Recalculate before updating payments.',
          );
        }

        const updatedTransfer = await transaction.settlementTransfer.update({
          where: { id: transferId },
          data: { isPaid, paidAt: isPaid ? new Date() : null },
          select: { id: true, isPaid: true, paidAt: true },
        });

        return updatedTransfer;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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

  private toResponse(plan: SettlementPlanRecord): SettlementsResponse {
    return {
      id: plan.id,
      revision: plan.revision,
      isCurrent: plan.isCurrent,
      createdAt: plan.createdAt,
      invalidatedAt: plan.invalidatedAt,
      currency: plan.currency,
      balances: plan.balances.map((balance) => ({
        participantId: balance.participantId,
        name: balance.participantName,
        balance: balance.balance.toFixed(2),
      })),
      settlements: plan.transfers.map((transfer) => ({
        id: transfer.id,
        from: {
          participantId: transfer.fromBalance.participantId,
          name: transfer.fromBalance.participantName,
        },
        to: {
          participantId: transfer.toBalance.participantId,
          name: transfer.toBalance.participantName,
        },
        amount: transfer.amount.toFixed(2),
        isPaid: transfer.isPaid,
        paidAt: transfer.paidAt,
      })),
      transferCount: plan.transferCount,
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

  private requireBalanceId(
    balanceIds: Map<string, string>,
    participantId: string,
  ): string {
    const balanceId = balanceIds.get(participantId);
    if (!balanceId) {
      throw new InternalServerErrorException(
        'The settlement plan contains an invalid participant balance.',
      );
    }
    return balanceId;
  }
}

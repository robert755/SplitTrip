import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Expense } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { invalidateCurrentSettlementPlans } from '../settlements/invalidate-settlement-plans.js';
import { CreateExpenseDto } from './dto/create-expense.dto.js';

const expenseSelect = {
  id: true,
  description: true,
  amount: true,
  createdAt: true,
  trip: { select: { currency: true } },
  payer: { select: { id: true, name: true } },
  shares: {
    select: {
      participantId: true,
      amount: true,
      participant: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ExpenseSelect;

type ExpenseRecord = Prisma.ExpenseGetPayload<{ select: typeof expenseSelect }>;

export interface ExpenseResponse {
  id: string;
  description: string;
  amount: string;
  currency: string;
  createdAt: Date;
  payer: { id: string; name: string };
  shares: Array<{
    participantId: string;
    amount: string;
    participant: { id: string; name: string };
  }>;
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async update(
    tripId: string,
    expenseId: string,
    ownerId: string,
    dto: CreateExpenseDto,
  ): Promise<ExpenseResponse> {
    await this.ensureTripIsOwnedByUser(tripId, ownerId);
    this.validateShareTotal(dto.amount, dto.shares);

    const participantIds = dto.shares.map((share) => share.participantId);
    if (new Set(participantIds).size !== participantIds.length) {
      throw new BadRequestException('A participant can only have one share.');
    }

    const validParticipants = await this.prisma.participant.findMany({
      where: {
        tripId,
        id: { in: [...new Set([...participantIds, dto.payerId])] },
      },
      select: { id: true },
    });
    const validParticipantIds = new Set(
      validParticipants.map((participant) => participant.id),
    );

    if (
      !validParticipantIds.has(dto.payerId) ||
      participantIds.some(
        (participantId) => !validParticipantIds.has(participantId),
      )
    ) {
      throw new BadRequestException(
        'The payer and all shares must belong to this trip.',
      );
    }

    const existingExpense = await this.prisma.expense.findFirst({
      where: { id: expenseId, tripId },
      select: { id: true },
    });
    if (!existingExpense) {
      throw new NotFoundException('Expense not found.');
    }

    const expense = await this.prisma.$transaction(
      async (transaction) => {
        await transaction.expenseShare.deleteMany({
          where: { expenseId },
        });

        const updatedExpense = await transaction.expense.update({
          where: { id: expenseId },
          data: {
            payerId: dto.payerId,
            description: dto.description,
            amount: dto.amount,
            shares: {
              create: dto.shares.map((share) => ({
                participantId: share.participantId,
                amount: share.amount,
              })),
            },
          },
          select: expenseSelect,
        });

        await invalidateCurrentSettlementPlans(transaction, tripId);
        return updatedExpense;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.toResponse(expense);
  }

  async create(
    tripId: string,
    ownerId: string,
    dto: CreateExpenseDto,
  ): Promise<ExpenseResponse> {
    await this.ensureTripIsOwnedByUser(tripId, ownerId);
    this.validateShareTotal(dto.amount, dto.shares);

    const participantIds = dto.shares.map((share) => share.participantId);
    if (new Set(participantIds).size !== participantIds.length) {
      throw new BadRequestException('A participant can only have one share.');
    }

    const validParticipants = await this.prisma.participant.findMany({
      where: {
        tripId,
        id: { in: [...new Set([...participantIds, dto.payerId])] },
      },
      select: { id: true },
    });
    const validParticipantIds = new Set(
      validParticipants.map((participant) => participant.id),
    );

    if (
      !validParticipantIds.has(dto.payerId) ||
      participantIds.some(
        (participantId) => !validParticipantIds.has(participantId),
      )
    ) {
      throw new BadRequestException(
        'The payer and all shares must belong to this trip.',
      );
    }

    const expense = await this.prisma.$transaction(
      async (transaction) => {
        const createdExpense = await transaction.expense.create({
          data: {
            tripId,
            payerId: dto.payerId,
            description: dto.description,
            amount: dto.amount,
            shares: {
              create: dto.shares.map((share) => ({
                participantId: share.participantId,
                amount: share.amount,
              })),
            },
          },
          select: expenseSelect,
        });

        await invalidateCurrentSettlementPlans(transaction, tripId);
        return createdExpense;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.toResponse(expense);
  }

  async findAll(tripId: string, ownerId: string): Promise<ExpenseResponse[]> {
    await this.ensureTripIsOwnedByUser(tripId, ownerId);
    const expenses = await this.prisma.expense.findMany({
      where: { tripId },
      orderBy: { createdAt: 'desc' },
      select: expenseSelect,
    });

    return expenses.map((expense) => this.toResponse(expense));
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

  private validateShareTotal(
    total: string,
    shares: CreateExpenseDto['shares'],
  ): void {
    const totalInCents = this.toCents(total);
    const sharesInCents = shares.reduce(
      (sum, share) => sum + this.toCents(share.amount),
      0n,
    );

    if (totalInCents !== sharesInCents) {
      throw new BadRequestException(
        'The participant shares must add up to the expense total.',
      );
    }
  }

  private toCents(amount: string): bigint {
    const [whole, fraction = ''] = amount.split('.');
    return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  }

  private toResponse(expense: ExpenseRecord): ExpenseResponse {
    return {
      id: expense.id,
      description: expense.description,
      amount: this.formatAmount(expense.amount),
      currency: expense.trip.currency,
      createdAt: expense.createdAt,
      payer: expense.payer,
      shares: expense.shares
        .map((share) => ({
          participantId: share.participantId,
          amount: this.formatAmount(share.amount),
          participant: share.participant,
        }))
        .sort((left, right) =>
          left.participant.name.localeCompare(right.participant.name),
        ),
    };
  }

  private formatAmount(amount: Expense['amount']): string {
    return amount.toFixed(2);
  }
}

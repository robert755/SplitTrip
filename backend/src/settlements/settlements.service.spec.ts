import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettlementsService } from './settlements.service.js';

describe('SettlementsService', () => {
  const tripId = 'c3f6b6b8-e238-4ac8-b970-6e507fa42942';
  const ownerId = '4a8f728e-bf6d-44db-a544-7c35d3ef9bf6';
  const payerId = 'ed8c3129-609f-40f3-aa94-1b32ea27f1db';
  const debtorId = '746f73d2-8b5a-45d0-badd-81de8fd2b2ab';
  const planId = '6ec9167d-2fc4-4a0f-997f-6528c81a1d53';
  const payerBalanceId = 'ea9597b6-2a7d-44ea-a682-4e685c918f0b';
  const debtorBalanceId = 'db779a35-7421-45dc-82df-064d07a93a16';
  const transferId = '9c77f693-ef26-471f-bca0-190cd924afdd';

  function savedPlan(isCurrent = true) {
    return {
      id: planId,
      tripId,
      revision: 1,
      currency: 'RON',
      transferCount: 1,
      isCurrent,
      createdAt: new Date('2026-11-18T12:00:00.000Z'),
      invalidatedAt: isCurrent ? null : new Date('2026-11-18T13:00:00.000Z'),
      balances: [
        {
          id: payerBalanceId,
          planId,
          participantId: payerId,
          participantName: 'Alex',
          balance: new Prisma.Decimal('120.00'),
        },
        {
          id: debtorBalanceId,
          planId,
          participantId: debtorId,
          participantName: 'Mara',
          balance: new Prisma.Decimal('-120.00'),
        },
      ],
      transfers: [
        {
          id: transferId,
          planId,
          sequence: 0,
          fromBalanceId: debtorBalanceId,
          toBalanceId: payerBalanceId,
          amount: new Prisma.Decimal('120.00'),
          isPaid: false,
          paidAt: null,
          fromBalance: { participantId: debtorId, participantName: 'Mara' },
          toBalance: { participantId: payerId, participantName: 'Alex' },
        },
      ],
    };
  }

  function createOwnerLookup() {
    return vi.fn().mockResolvedValue({ id: tripId });
  }

  it('saves balances and minimum transfers as a versioned plan', async () => {
    const storedPlan = savedPlan();
    const transaction = {
      settlementPlan: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({
          id: planId,
          balances: [
            { id: payerBalanceId, participantId: payerId },
            { id: debtorBalanceId, participantId: debtorId },
          ],
        }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(storedPlan),
      },
      settlementTransfer: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      trip: {
        findUnique: vi.fn().mockResolvedValue({
          id: tripId,
          currency: 'RON',
          participants: [
            { id: payerId, name: 'Alex' },
            { id: debtorId, name: 'Mara' },
          ],
          expenses: [
            {
              amount: new Prisma.Decimal('120.00'),
              payerId,
              shares: [
                {
                  participantId: debtorId,
                  amount: new Prisma.Decimal('120.00'),
                },
              ],
            },
          ],
        }),
      },
    };
    const prismaMock = {
      trip: { findFirst: createOwnerLookup() },
      $transaction: vi.fn(
        async (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const service = new SettlementsService(
      prismaMock as unknown as PrismaService,
    );

    const result = await service.calculate(tripId, ownerId);

    expect(result.isCurrent).toBe(true);
    expect(result.balances.map((balance) => balance.balance)).toEqual([
      '120.00',
      '-120.00',
    ]);
    expect(result.settlements[0]).toMatchObject({
      from: { participantId: debtorId, name: 'Mara' },
      to: { participantId: payerId, name: 'Alex' },
      amount: '120.00',
      isPaid: false,
    });
    expect(transaction.settlementTransfer.createMany).toHaveBeenCalledWith({
      data: [
        {
          planId,
          sequence: 0,
          fromBalanceId: debtorBalanceId,
          toBalanceId: payerBalanceId,
          amount: '120.00',
        },
      ],
    });
  });

  it('returns the saved current plan instead of calculating it again', async () => {
    const currentPlan = savedPlan();
    const transaction = {
      settlementPlan: { findFirst: vi.fn().mockResolvedValue(currentPlan) },
    };
    const prismaMock = {
      trip: { findFirst: createOwnerLookup() },
      $transaction: vi.fn(
        async (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const service = new SettlementsService(
      prismaMock as unknown as PrismaService,
    );

    const result = await service.calculate(tripId, ownerId);

    expect(result.id).toBe(planId);
    expect(transaction.settlementPlan.findFirst).toHaveBeenCalledTimes(1);
  });

  it('does not allow payment updates on an outdated plan', async () => {
    const transaction = {
      settlementTransfer: {
        findFirst: vi.fn().mockResolvedValue({
          id: transferId,
          plan: { isCurrent: false },
        }),
        update: vi.fn(),
      },
    };
    const prismaMock = {
      trip: { findFirst: createOwnerLookup() },
      $transaction: vi.fn(
        async (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const service = new SettlementsService(
      prismaMock as unknown as PrismaService,
    );

    await expect(
      service.setTransferPaid(tripId, transferId, ownerId, true),
    ).rejects.toThrow(ConflictException);
    expect(transaction.settlementTransfer.update).not.toHaveBeenCalled();
  });

  it('records payment state and timestamp on the current transfer', async () => {
    const paidAt = new Date('2026-11-18T14:00:00.000Z');
    const transaction = {
      settlementTransfer: {
        findFirst: vi.fn().mockResolvedValue({
          id: transferId,
          plan: { isCurrent: true },
        }),
        update: vi
          .fn()
          .mockImplementation(
            async ({
              data,
            }: {
              data: { isPaid: boolean; paidAt: Date | null };
            }) => ({
              id: transferId,
              isPaid: data.isPaid,
              paidAt: data.paidAt ? paidAt : null,
            }),
          ),
      },
    };
    const prismaMock = {
      trip: { findFirst: createOwnerLookup() },
      $transaction: vi.fn(
        async (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const service = new SettlementsService(
      prismaMock as unknown as PrismaService,
    );

    await expect(
      service.setTransferPaid(tripId, transferId, ownerId, true),
    ).resolves.toEqual({ id: transferId, isPaid: true, paidAt });
    expect(transaction.settlementTransfer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPaid: true }),
      }),
    );
  });
});

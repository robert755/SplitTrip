import {
  calculateMinimumTransfers,
  MAX_EXACT_SETTLEMENT_PARTICIPANTS,
} from './minimum-transfers.js';

describe('calculateMinimumTransfers', () => {
  it('uses the minimum number of transfers for independent zero-sum groups', () => {
    const transfers = calculateMinimumTransfers([
      { participantId: 'A', balance: 10_000n },
      { participantId: 'B', balance: -10_000n },
      { participantId: 'C', balance: 5_000n },
      { participantId: 'D', balance: -5_000n },
    ]);

    expect(transfers).toHaveLength(2);
    expect(transfers).toEqual(
      expect.arrayContaining([
        {
          fromParticipantId: 'B',
          toParticipantId: 'A',
          amount: 10_000n,
        },
        {
          fromParticipantId: 'D',
          toParticipantId: 'C',
          amount: 5_000n,
        },
      ]),
    );
  });

  it('handles a debtor settling several creditors with the fewest transfers', () => {
    const transfers = calculateMinimumTransfers([
      { participantId: 'A', balance: 10_000n },
      { participantId: 'B', balance: -3_000n },
      { participantId: 'C', balance: -7_000n },
    ]);

    expect(transfers).toHaveLength(2);
    expect(
      transfers.every((transfer) => transfer.fromParticipantId !== 'A'),
    ).toBe(true);
    expect(transfers.reduce((sum, transfer) => sum + transfer.amount, 0n)).toBe(
      10_000n,
    );
  });

  it('returns no transfers for zero balances', () => {
    expect(
      calculateMinimumTransfers([
        { participantId: 'A', balance: 0n },
        { participantId: 'B', balance: 0n },
      ]),
    ).toEqual([]);
  });

  it('rejects groups above the exact calculation limit', () => {
    const balances = Array.from(
      { length: MAX_EXACT_SETTLEMENT_PARTICIPANTS + 1 },
      (_, index) => ({
        participantId: String(index),
        balance: index === 0 ? BigInt(MAX_EXACT_SETTLEMENT_PARTICIPANTS) : -1n,
      }),
    );

    expect(() => calculateMinimumTransfers(balances)).toThrow(RangeError);
  });

  it('calculates exactly at the 16-balance limit', () => {
    const balances = Array.from({ length: 16 }, (_, index) => ({
      participantId: String(index),
      balance: index < 8 ? 1n : -1n,
    }));

    expect(calculateMinimumTransfers(balances)).toHaveLength(8);
  });
});

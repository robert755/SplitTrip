export const MAX_EXACT_SETTLEMENT_PARTICIPANTS = 16;

export interface NetBalance {
  participantId: string;
  balance: bigint;
}

export interface Transfer {
  fromParticipantId: string;
  toParticipantId: string;
  amount: bigint;
}

export function calculateMinimumTransfers(
  input: readonly NetBalance[],
): Transfer[] {
  const balances = input.filter(({ balance }) => balance !== 0n);
  if (balances.length > MAX_EXACT_SETTLEMENT_PARTICIPANTS) {
    throw new RangeError(
      `Exact settlement calculation supports at most ${MAX_EXACT_SETTLEMENT_PARTICIPANTS} non-zero balances.`,
    );
  }
  if (balances.reduce((sum, item) => sum + item.balance, 0n) !== 0n) {
    throw new RangeError('Net balances must sum to zero.');
  }
  if (balances.length === 0) {
    return [];
  }

  const stateCount = 1 << balances.length;
  const subsetSums = Array.from({ length: stateCount }, () => 0n);
  for (let mask = 1; mask < stateCount; mask++) {
    const leastSignificantBit = mask & -mask;
    const index = 31 - Math.clz32(leastSignificantBit);
    subsetSums[mask] =
      subsetSums[mask ^ leastSignificantBit] + balances[index].balance;
  }

  const groupCounts = new Int8Array(stateCount).fill(-1);
  const chosenGroups = new Uint32Array(stateCount);
  groupCounts[0] = 0;

  for (let mask = 1; mask < stateCount; mask++) {
    if (subsetSums[mask] !== 0n) {
      continue;
    }

    let bestCount = 1;
    let bestGroup = mask;
    const firstBit = mask & -mask;

    for (let group = mask; group > 0; group = (group - 1) & mask) {
      if ((group & firstBit) === 0 || subsetSums[group] !== 0n) {
        continue;
      }

      const remainder = mask ^ group;
      if (groupCounts[remainder] + 1 > bestCount) {
        bestCount = groupCounts[remainder] + 1;
        bestGroup = group;
      }
    }

    groupCounts[mask] = bestCount;
    chosenGroups[mask] = bestGroup;
  }

  const groups: number[][] = [];
  let remainingMask = stateCount - 1;
  while (remainingMask > 0) {
    const groupMask = chosenGroups[remainingMask];
    if (groupMask === 0) {
      throw new Error('Unable to partition balanced participant groups.');
    }

    const group: number[] = [];
    for (let index = 0; index < balances.length; index++) {
      if ((groupMask & (1 << index)) !== 0) {
        group.push(index);
      }
    }
    groups.push(group);
    remainingMask ^= groupMask;
  }

  const transfers: Transfer[] = [];
  for (const group of groups) {
    const debtors = group
      .map((index) => ({ index, balance: balances[index].balance }))
      .filter((item) => item.balance < 0n);
    const creditors = group
      .map((index) => ({ index, balance: balances[index].balance }))
      .filter((item) => item.balance > 0n);
    let debtorIndex = 0;
    let creditorIndex = 0;

    while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];
      const amount =
        -debtor.balance < creditor.balance ? -debtor.balance : creditor.balance;

      transfers.push({
        fromParticipantId: balances[debtor.index].participantId,
        toParticipantId: balances[creditor.index].participantId,
        amount,
      });

      debtor.balance += amount;
      creditor.balance -= amount;
      if (debtor.balance === 0n) {
        debtorIndex++;
      }
      if (creditor.balance === 0n) {
        creditorIndex++;
      }
    }
  }

  return transfers;
}

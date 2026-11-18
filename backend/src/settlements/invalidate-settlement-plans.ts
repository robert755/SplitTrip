import { Prisma } from '../generated/prisma/client.js';

export async function invalidateCurrentSettlementPlans(
  transaction: Pick<Prisma.TransactionClient, 'settlementPlan'>,
  tripId: string,
): Promise<void> {
  await transaction.settlementPlan.updateMany({
    where: { tripId, isCurrent: true },
    data: { isCurrent: false, invalidatedAt: new Date() },
  });
}

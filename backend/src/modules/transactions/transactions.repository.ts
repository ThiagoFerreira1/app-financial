import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleClient,
  type DrizzleExecutor,
} from '../../database/drizzle.module.js';
import {
  transactions,
  type NewTransaction,
  type Transaction,
} from '../../database/schema/transactions.schema.js';

export type TransactionSyncData = Pick<
  NewTransaction,
  'description' | 'type' | 'amount' | 'categoryId' | 'accountId'
>;

export interface AccountBalanceDelta {
  accountId: string;
  delta: number;
}

@Injectable()
export class TransactionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  async create(data: NewTransaction): Promise<Transaction> {
    const [transaction] = await this.db
      .insert(transactions)
      .values(data)
      .returning();
    return transaction;
  }

  async deleteById(
    id: string,
    executor: DrizzleExecutor = this.db,
  ): Promise<void> {
    await executor.delete(transactions).where(eq(transactions.id, id));
  }

  async update(id: string, data: TransactionSyncData): Promise<Transaction> {
    const [transaction] = await this.db
      .update(transactions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(transactions.id, id))
      .returning();
    return transaction;
  }

  async getBalanceDeltasByUser(userId: string): Promise<AccountBalanceDelta[]> {
    const rows = await this.db
      .select({
        accountId: transactions.accountId,
        delta: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'receita' THEN ${transactions.amount} ELSE -${transactions.amount} END), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .groupBy(transactions.accountId);

    return rows.map((row) => ({
      accountId: row.accountId,
      delta: Number(row.delta),
    }));
  }
}

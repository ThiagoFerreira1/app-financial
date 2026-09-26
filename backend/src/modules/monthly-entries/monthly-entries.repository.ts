import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleClient,
  type DrizzleExecutor,
} from '../../database/drizzle.module.js';
import {
  monthlyEntries,
  type MonthlyEntry,
  type NewMonthlyEntry,
} from '../../database/schema/monthly-entries.schema.js';

@Injectable()
export class MonthlyEntriesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  async create(
    data: NewMonthlyEntry,
    executor: DrizzleExecutor = this.db,
  ): Promise<MonthlyEntry | undefined> {
    const [entry] = await executor
      .insert(monthlyEntries)
      .values(data)
      .onConflictDoNothing({
        target: [
          monthlyEntries.recurrenceId,
          monthlyEntries.month,
          monthlyEntries.year,
        ],
        where: sql`${monthlyEntries.recurrenceId} is not null`,
      })
      .returning();
    return entry;
  }

  async findAllByUserAndPeriod(
    userId: string,
    month: number,
    year: number,
  ): Promise<MonthlyEntry[]> {
    return this.db
      .select()
      .from(monthlyEntries)
      .where(
        and(
          eq(monthlyEntries.userId, userId),
          eq(monthlyEntries.month, month),
          eq(monthlyEntries.year, year),
        ),
      );
  }

  async findOwnedById(
    id: string,
    userId: string,
  ): Promise<MonthlyEntry | undefined> {
    const [entry] = await this.db
      .select()
      .from(monthlyEntries)
      .where(and(eq(monthlyEntries.id, id), eq(monthlyEntries.userId, userId)))
      .limit(1);
    return entry;
  }

  async update(
    id: string,
    data: Partial<NewMonthlyEntry>,
    executor: DrizzleExecutor = this.db,
  ): Promise<MonthlyEntry> {
    const [entry] = await executor
      .update(monthlyEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(monthlyEntries.id, id))
      .returning();
    return entry;
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(monthlyEntries).where(eq(monthlyEntries.id, id));
  }

  async markAsSettled(
    id: string,
    transactionId: string,
  ): Promise<MonthlyEntry> {
    return this.update(id, { transactionId, status: 'liquidado' });
  }

  async markAsUnsettled(
    id: string,
    executor: DrizzleExecutor = this.db,
  ): Promise<MonthlyEntry> {
    return this.update(id, { transactionId: null, status: 'pendente' }, executor);
  }

  async markAsSkipped(id: string): Promise<MonthlyEntry> {
    return this.update(id, { status: 'pulado' });
  }

  async markAsUnskipped(id: string): Promise<MonthlyEntry> {
    return this.update(id, { status: 'pendente' });
  }
}

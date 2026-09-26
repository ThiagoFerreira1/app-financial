import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, lt } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleClient,
  type DrizzleExecutor,
} from '../../database/drizzle.module.js';
import {
  recurrences,
  type NewRecurrence,
  type Recurrence,
} from '../../database/schema/recurrences.schema.js';

export interface RecurrenceFilters {
  active?: boolean;
  categoryId?: string;
  accountId?: string;
}

@Injectable()
export class RecurrencesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  async create(data: NewRecurrence): Promise<Recurrence> {
    const [recurrence] = await this.db
      .insert(recurrences)
      .values(data)
      .returning();
    return recurrence;
  }

  async findAllByUser(
    userId: string,
    filters: RecurrenceFilters = {},
  ): Promise<Recurrence[]> {
    const conditions = [
      eq(recurrences.userId, userId),
      isNull(recurrences.deletedAt),
    ];
    if (filters.active !== undefined) {
      conditions.push(eq(recurrences.active, filters.active));
    }
    if (filters.categoryId) {
      conditions.push(eq(recurrences.categoryId, filters.categoryId));
    }
    if (filters.accountId) {
      conditions.push(eq(recurrences.accountId, filters.accountId));
    }

    return this.db
      .select()
      .from(recurrences)
      .where(and(...conditions));
  }

  async findOwnedById(
    id: string,
    userId: string,
  ): Promise<Recurrence | undefined> {
    const [recurrence] = await this.db
      .select()
      .from(recurrences)
      .where(
        and(
          eq(recurrences.id, id),
          eq(recurrences.userId, userId),
          isNull(recurrences.deletedAt),
        ),
      )
      .limit(1);
    return recurrence;
  }

  async findEligibleForPeriod(
    userId: string,
    periodEnd: Date,
  ): Promise<Recurrence[]> {
    return this.db
      .select()
      .from(recurrences)
      .where(
        and(
          eq(recurrences.userId, userId),
          eq(recurrences.active, true),
          isNull(recurrences.deletedAt),
          lt(recurrences.createdAt, periodEnd),
        ),
      );
  }

  async update(
    id: string,
    data: Partial<NewRecurrence>,
    executor: DrizzleExecutor = this.db,
  ): Promise<Recurrence> {
    const [recurrence] = await executor
      .update(recurrences)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(recurrences.id, id))
      .returning();
    return recurrence;
  }

  async softDelete(id: string): Promise<void> {
    await this.db
      .update(recurrences)
      .set({ deletedAt: new Date(), active: false, updatedAt: new Date() })
      .where(eq(recurrences.id, id));
  }
}

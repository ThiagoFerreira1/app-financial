import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleClient } from '../../database/drizzle.module.js';
import {
  accounts,
  type Account,
  type NewAccount,
} from '../../database/schema/accounts.schema.js';

@Injectable()
export class AccountsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  async create(data: NewAccount): Promise<Account> {
    const [account] = await this.db.insert(accounts).values(data).returning();
    return account;
  }

  async findAllByUser(userId: string): Promise<Account[]> {
    return this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt)));
  }

  async findOwnedById(id: string, userId: string): Promise<Account | undefined> {
    const [account] = await this.db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, id),
          eq(accounts.userId, userId),
          isNull(accounts.deletedAt),
        ),
      )
      .limit(1);
    return account;
  }

  async update(
    id: string,
    data: Partial<Pick<NewAccount, 'name' | 'initialBalance'>>,
  ): Promise<Account> {
    const [account] = await this.db
      .update(accounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accounts.id, id))
      .returning();
    return account;
  }

  async softDelete(id: string): Promise<void> {
    await this.db
      .update(accounts)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(accounts.id, id));
  }
}

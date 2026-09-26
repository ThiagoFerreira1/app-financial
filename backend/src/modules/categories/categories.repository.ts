import { Inject, Injectable } from '@nestjs/common';
import { and, eq, ilike, isNull, ne, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleClient } from '../../database/drizzle.module.js';
import {
  categories,
  type Category,
  type NewCategory,
} from '../../database/schema/categories.schema.js';

@Injectable()
export class CategoriesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  async create(data: NewCategory): Promise<Category> {
    const [category] = await this.db
      .insert(categories)
      .values(data)
      .returning();
    return category;
  }

  async findAllByUser(userId: string, nameFilter?: string): Promise<Category[]> {
    const conditions = [
      eq(categories.userId, userId),
      isNull(categories.deletedAt),
    ];
    if (nameFilter) {
      conditions.push(ilike(categories.name, `%${nameFilter}%`));
    }

    return this.db
      .select()
      .from(categories)
      .where(and(...conditions));
  }

  async findOwnedById(id: string, userId: string): Promise<Category | undefined> {
    const [category] = await this.db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.id, id),
          eq(categories.userId, userId),
          isNull(categories.deletedAt),
        ),
      )
      .limit(1);
    return category;
  }

  async findByNameCaseInsensitive(
    userId: string,
    name: string,
    excludeId?: string,
  ): Promise<Category | undefined> {
    const conditions = [
      eq(categories.userId, userId),
      isNull(categories.deletedAt),
      sql`lower(${categories.name}) = lower(${name})`,
    ];
    if (excludeId) {
      conditions.push(ne(categories.id, excludeId));
    }

    const [category] = await this.db
      .select()
      .from(categories)
      .where(and(...conditions))
      .limit(1);
    return category;
  }

  async update(id: string, name: string): Promise<Category> {
    const [category] = await this.db
      .update(categories)
      .set({ name, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    return category;
  }

  async softDelete(id: string): Promise<void> {
    await this.db
      .update(categories)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(categories.id, id));
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleClient } from '../database/drizzle.module.js';
import {
  users,
  type NewUser,
  type User,
} from '../database/schema/users.schema.js';

@Injectable()
export class AuthRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleClient) {}

  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  }

  async findById(id: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user;
  }

  async create(data: NewUser): Promise<User> {
    const [user] = await this.db.insert(users).values(data).returning();
    return user;
  }

  async updateRefreshTokenHash(
    userId: string,
    refreshTokenHash: string | null,
    refreshTokenExpiresAt: Date | null,
  ): Promise<void> {
    await this.db
      .update(users)
      .set({ refreshTokenHash, refreshTokenExpiresAt, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }
}

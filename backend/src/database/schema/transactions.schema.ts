import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema.js';
import { categories } from './categories.schema.js';
import { users } from './users.schema.js';

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    description: text('description').notNull(),
    type: text('type').notNull().$type<'despesa' | 'receita'>(),
    amount: integer('amount').notNull(),
    settledAt: timestamp('settled_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check('transactions_type_check', sql`${table.type} IN ('despesa', 'receita')`),
  ],
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

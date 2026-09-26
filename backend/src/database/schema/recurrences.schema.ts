import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema.js';
import { categories } from './categories.schema.js';
import { users } from './users.schema.js';

export const recurrences = pgTable('recurrences', {
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
  defaultAmount: integer('default_amount').notNull(),
  dueDay: integer('due_day').notNull(),
  active: boolean('active').notNull().default(true),
  installmentsTotal: integer('installments_total'),
  installmentsGenerated: integer('installments_generated').notNull().default(0),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Recurrence = typeof recurrences.$inferSelect;
export type NewRecurrence = typeof recurrences.$inferInsert;

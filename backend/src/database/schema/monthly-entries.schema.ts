import { sql } from 'drizzle-orm';
import {
  check,
  date,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { accounts } from './accounts.schema.js';
import { categories } from './categories.schema.js';
import { recurrences } from './recurrences.schema.js';
import { transactions } from './transactions.schema.js';
import { users } from './users.schema.js';

export const monthlyEntries = pgTable(
  'monthly_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    recurrenceId: uuid('recurrence_id').references(() => recurrences.id),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id),
    transactionId: uuid('transaction_id').references(() => transactions.id),
    description: text('description').notNull(),
    type: text('type').notNull().$type<'despesa' | 'receita'>(),
    amount: integer('amount').notNull(),
    dueDate: date('due_date').notNull(),
    status: text('status')
      .notNull()
      .default('pendente')
      .$type<'pendente' | 'liquidado' | 'pulado'>(),
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    installmentNumber: integer('installment_number'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('monthly_entries_recurrence_id_month_year_unique')
      .on(table.recurrenceId, table.month, table.year)
      .where(sql`${table.recurrenceId} is not null`),
    check(
      'monthly_entries_type_check',
      sql`${table.type} IN ('despesa', 'receita')`,
    ),
    check(
      'monthly_entries_status_check',
      sql`${table.status} IN ('pendente', 'liquidado', 'pulado')`,
    ),
  ],
);

export type MonthlyEntry = typeof monthlyEntries.$inferSelect;
export type NewMonthlyEntry = typeof monthlyEntries.$inferInsert;

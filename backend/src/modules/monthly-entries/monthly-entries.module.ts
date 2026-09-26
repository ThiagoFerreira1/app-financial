import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module.js';
import { DrizzleModule } from '../../database/drizzle.module.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { RecurrencesModule } from '../recurrences/recurrences.module.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { MonthlyEntriesController } from './controller/monthly-entries.controller.js';
import { MonthlyEntriesRepository } from './monthly-entries.repository.js';
import { MonthlyEntriesService } from './service/monthly-entries.service.js';

@Module({
  imports: [
    DrizzleModule,
    CommonModule,
    CategoriesModule,
    AccountsModule,
    RecurrencesModule,
    TransactionsModule,
  ],
  controllers: [MonthlyEntriesController],
  providers: [MonthlyEntriesService, MonthlyEntriesRepository],
})
export class MonthlyEntriesModule {}

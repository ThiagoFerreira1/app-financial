import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module.js';
import { DrizzleModule } from '../../database/drizzle.module.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { RecurrencesController } from './controller/recurrences.controller.js';
import { RecurrencesRepository } from './recurrences.repository.js';
import { RecurrencesService } from './service/recurrences.service.js';

@Module({
  imports: [DrizzleModule, CommonModule, CategoriesModule, AccountsModule],
  controllers: [RecurrencesController],
  providers: [RecurrencesService, RecurrencesRepository],
  exports: [RecurrencesRepository],
})
export class RecurrencesModule {}

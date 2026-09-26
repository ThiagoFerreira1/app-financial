import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module.js';
import { DrizzleModule } from '../../database/drizzle.module.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { AccountsController } from './controller/accounts.controller.js';
import { AccountsRepository } from './accounts.repository.js';
import { AccountsService } from './service/accounts.service.js';

@Module({
  imports: [DrizzleModule, CommonModule, TransactionsModule],
  controllers: [AccountsController],
  providers: [AccountsService, AccountsRepository],
  exports: [AccountsRepository],
})
export class AccountsModule {}

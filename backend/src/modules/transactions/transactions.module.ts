import { Module } from '@nestjs/common';
import { DrizzleModule } from '../../database/drizzle.module.js';
import { TransactionsRepository } from './transactions.repository.js';

@Module({
  imports: [DrizzleModule],
  providers: [TransactionsRepository],
  exports: [TransactionsRepository],
})
export class TransactionsModule {}

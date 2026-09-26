import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { RecurrencesModule } from './modules/recurrences/recurrences.module.js';
import { MonthlyEntriesModule } from './modules/monthly-entries/monthly-entries.module.js';
import { validate } from './config/env.validation.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    AuthModule,
    AccountsModule,
    CategoriesModule,
    RecurrencesModule,
    MonthlyEntriesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

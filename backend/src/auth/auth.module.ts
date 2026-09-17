import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module.js';
import { DrizzleModule } from '../database/drizzle.module.js';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [DrizzleModule, CommonModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
})
export class AuthModule {}

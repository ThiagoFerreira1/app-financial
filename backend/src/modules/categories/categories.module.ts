import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module.js';
import { DrizzleModule } from '../../database/drizzle.module.js';
import { CategoriesController } from './controller/categories.controller.js';
import { CategoriesRepository } from './categories.repository.js';
import { CategoriesService } from './service/categories.service.js';

@Module({
  imports: [DrizzleModule, CommonModule],
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoriesRepository],
})
export class CategoriesModule {}

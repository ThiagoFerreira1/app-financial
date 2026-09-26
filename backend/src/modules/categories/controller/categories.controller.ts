import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import { CategoriesService } from '../service/categories.service.js';
import type { Category } from '../../../database/schema/categories.schema.js';
import {
  createCategorySchema,
  type CreateCategoryDto,
} from '../dto/create-category.dto.js';
import {
  updateCategorySchema,
  type UpdateCategoryDto,
} from '../dto/update-category.dto.js';
import {
  findCategoriesQuerySchema,
  type FindCategoriesQueryDto,
} from '../dto/find-categories-query.dto.js';

@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(
    @CurrentUser() user: { sub: string } | undefined,
    @Body(new ZodValidationPipe(createCategorySchema)) dto: CreateCategoryDto,
  ): Promise<Category> {
    return this.categoriesService.create(user!.sub, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: { sub: string } | undefined,
    @Query(new ZodValidationPipe(findCategoriesQuerySchema))
    query: FindCategoriesQueryDto,
  ): Promise<Category[]> {
    return this.categoriesService.findAll(user!.sub, query.name);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string } | undefined,
    @Body(new ZodValidationPipe(updateCategorySchema)) dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoriesService.update(id, user!.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string } | undefined,
  ): Promise<null> {
    await this.categoriesService.remove(id, user!.sub);
    return null;
  }
}

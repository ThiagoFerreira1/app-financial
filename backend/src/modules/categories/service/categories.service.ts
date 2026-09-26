import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoriesRepository } from '../categories.repository.js';
import type { Category } from '../../../database/schema/categories.schema.js';
import type { CreateCategoryDto } from '../dto/create-category.dto.js';
import type { UpdateCategoryDto } from '../dto/update-category.dto.js';

const DUPLICATE_NAME_ERROR = 'Já existe uma categoria com esse nome';
const NOT_FOUND_ERROR = 'Categoria não encontrada';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.categoriesRepository.findByNameCaseInsensitive(
      userId,
      dto.name,
    );
    if (existing) {
      throw new ConflictException(DUPLICATE_NAME_ERROR);
    }

    return this.categoriesRepository.create({ userId, name: dto.name });
  }

  async findAll(userId: string, nameFilter?: string): Promise<Category[]> {
    return this.categoriesRepository.findAllByUser(userId, nameFilter);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    const category = await this.categoriesRepository.findOwnedById(id, userId);
    if (!category) {
      throw new NotFoundException(NOT_FOUND_ERROR);
    }

    const duplicate = await this.categoriesRepository.findByNameCaseInsensitive(
      userId,
      dto.name,
      id,
    );
    if (duplicate) {
      throw new ConflictException(DUPLICATE_NAME_ERROR);
    }

    return this.categoriesRepository.update(id, dto.name);
  }

  async remove(id: string, userId: string): Promise<void> {
    const category = await this.categoriesRepository.findOwnedById(id, userId);
    if (!category) {
      throw new NotFoundException(NOT_FOUND_ERROR);
    }

    await this.categoriesRepository.softDelete(id);
  }
}

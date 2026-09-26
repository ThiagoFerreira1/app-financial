import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CategoriesRepository } from '../../categories/categories.repository.js';
import {
  RecurrencesRepository,
  type RecurrenceFilters,
} from '../recurrences.repository.js';
import type { Recurrence } from '../../../database/schema/recurrences.schema.js';
import type { CreateRecurrenceDto } from '../dto/create-recurrence.dto.js';
import type { UpdateRecurrenceDto } from '../dto/update-recurrence.dto.js';

const CATEGORY_NOT_FOUND_ERROR = 'Categoria não encontrada';
const RECURRENCE_NOT_FOUND_ERROR = 'Recorrência não encontrada';
const INSTALLMENTS_TOTAL_BELOW_GENERATED_ERROR =
  'installmentsTotal não pode ser menor que as parcelas já geradas';

@Injectable()
export class RecurrencesService {
  constructor(
    private readonly recurrencesRepository: RecurrencesRepository,
    private readonly categoriesRepository: CategoriesRepository,
  ) {}

  async create(userId: string, dto: CreateRecurrenceDto): Promise<Recurrence> {
    await this.assertCategoryOwnership(dto.categoryId, userId);

    return this.recurrencesRepository.create({
      userId,
      categoryId: dto.categoryId,
      description: dto.description,
      type: dto.type,
      defaultAmount: dto.defaultAmount,
      dueDay: dto.dueDay,
      installmentsTotal: dto.installmentsTotal ?? null,
    });
  }

  async findAll(
    userId: string,
    filters: RecurrenceFilters = {},
  ): Promise<Recurrence[]> {
    return this.recurrencesRepository.findAllByUser(userId, {
      active: filters.active ?? true,
      categoryId: filters.categoryId,
    });
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateRecurrenceDto,
  ): Promise<Recurrence> {
    const recurrence = await this.recurrencesRepository.findOwnedById(
      id,
      userId,
    );
    if (!recurrence) {
      throw new NotFoundException(RECURRENCE_NOT_FOUND_ERROR);
    }

    if (dto.categoryId) {
      await this.assertCategoryOwnership(dto.categoryId, userId);
    }

    if (
      dto.installmentsTotal !== undefined &&
      dto.installmentsTotal < recurrence.installmentsGenerated
    ) {
      throw new BadRequestException(INSTALLMENTS_TOTAL_BELOW_GENERATED_ERROR);
    }

    return this.recurrencesRepository.update(id, dto);
  }

  async remove(id: string, userId: string): Promise<void> {
    const recurrence = await this.recurrencesRepository.findOwnedById(
      id,
      userId,
    );
    if (!recurrence) {
      throw new NotFoundException(RECURRENCE_NOT_FOUND_ERROR);
    }

    await this.recurrencesRepository.softDelete(id);
  }

  private async assertCategoryOwnership(
    categoryId: string,
    userId: string,
  ): Promise<void> {
    const category = await this.categoriesRepository.findOwnedById(
      categoryId,
      userId,
    );
    if (!category) {
      throw new NotFoundException(CATEGORY_NOT_FOUND_ERROR);
    }
  }
}

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE, type DrizzleClient } from '../../../database/drizzle.module.js';
import type { MonthlyEntry } from '../../../database/schema/monthly-entries.schema.js';
import { AccountsRepository } from '../../accounts/accounts.repository.js';
import { CategoriesRepository } from '../../categories/categories.repository.js';
import { RecurrencesRepository } from '../../recurrences/recurrences.repository.js';
import { TransactionsRepository } from '../../transactions/transactions.repository.js';
import type { CreateMonthlyEntryDto } from '../dto/create-monthly-entry.dto.js';
import type { SettleMonthlyEntryDto } from '../dto/settle-monthly-entry.dto.js';
import type { UpdateMonthlyEntryDto } from '../dto/update-monthly-entry.dto.js';
import { MonthlyEntriesRepository } from '../monthly-entries.repository.js';

const CATEGORY_NOT_FOUND_ERROR = 'Categoria não encontrada';
const ACCOUNT_NOT_FOUND_ERROR = 'Conta não encontrada';
const ENTRY_NOT_FOUND_ERROR = 'Lançamento não encontrado';
const TYPE_NOT_EDITABLE_ERROR =
  'Não é possível editar o tipo de um lançamento vinculado a uma recorrência';
const DUE_DATE_OUTSIDE_MONTH_ERROR =
  'A nova data de vencimento precisa permanecer no mesmo mês do lançamento';
const CANNOT_DELETE_RECURRENCE_LINKED_ERROR =
  'Lançamentos vinculados a uma recorrência não podem ser excluídos; use a ação de pular';
const CANNOT_DELETE_SETTLED_ERROR =
  'Lançamento já liquidado não pode ser excluído; desfaça a liquidação primeiro';
const ALREADY_SETTLED_OR_SKIPPED_ERROR = 'Lançamento já está liquidado ou pulado';
const NOT_SETTLED_ERROR = 'Lançamento não está liquidado';
const ONLY_RECURRENCE_LINKED_CAN_BE_SKIPPED_ERROR =
  'Somente lançamentos vinculados a uma recorrência podem ser pulados';
const NOT_PENDING_ERROR = 'Lançamento não está pendente';
const NOT_SKIPPED_ERROR = 'Lançamento não está pulado';

export interface MonthlyEntryResponse extends MonthlyEntry {
  isOverdue: boolean;
}

export interface MonthlyEntryPreview {
  id: null;
  recurrenceId: string;
  categoryId: string;
  accountId: string;
  description: string;
  type: 'despesa' | 'receita';
  amount: number;
  dueDate: string;
  month: number;
  year: number;
  installmentNumber: number | null;
  isOverdue: false;
}

@Injectable()
export class MonthlyEntriesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleClient,
    private readonly monthlyEntriesRepository: MonthlyEntriesRepository,
    private readonly recurrencesRepository: RecurrencesRepository,
    private readonly categoriesRepository: CategoriesRepository,
    private readonly accountsRepository: AccountsRepository,
    private readonly transactionsRepository: TransactionsRepository,
  ) {}

  async findAllForPeriod(
    userId: string,
    month: number,
    year: number,
  ): Promise<(MonthlyEntryResponse | MonthlyEntryPreview)[]> {
    if (this.isFuturePeriod(month, year)) {
      return this.buildPreview(userId, month, year);
    }

    await this.generateForPeriod(userId, month, year);

    const entries = await this.monthlyEntriesRepository.findAllByUserAndPeriod(
      userId,
      month,
      year,
    );
    return entries.map((entry) => this.withOverdue(entry));
  }

  async create(
    userId: string,
    dto: CreateMonthlyEntryDto,
  ): Promise<MonthlyEntryResponse> {
    await this.assertCategoryOwnership(dto.categoryId, userId);
    await this.assertAccountOwnership(dto.accountId, userId);

    const { month, year } = this.parseDateParts(dto.dueDate);

    const entry = await this.monthlyEntriesRepository.create({
      userId,
      categoryId: dto.categoryId,
      accountId: dto.accountId,
      description: dto.description,
      type: dto.type,
      amount: dto.amount,
      dueDate: dto.dueDate,
      month,
      year,
    });

    return this.withOverdue(entry!);
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateMonthlyEntryDto,
  ): Promise<MonthlyEntryResponse> {
    const entry = await this.monthlyEntriesRepository.findOwnedById(id, userId);
    if (!entry) {
      throw new NotFoundException(ENTRY_NOT_FOUND_ERROR);
    }

    if (dto.type !== undefined && entry.recurrenceId) {
      throw new BadRequestException(TYPE_NOT_EDITABLE_ERROR);
    }

    if (dto.categoryId) {
      await this.assertCategoryOwnership(dto.categoryId, userId);
    }

    if (dto.accountId) {
      await this.assertAccountOwnership(dto.accountId, userId);
    }

    if (dto.dueDate) {
      const { month: newMonth, year: newYear } = this.parseDateParts(dto.dueDate);
      if (newMonth !== entry.month || newYear !== entry.year) {
        throw new BadRequestException(DUE_DATE_OUTSIDE_MONTH_ERROR);
      }
    }

    const updated = await this.monthlyEntriesRepository.update(id, dto);

    if (updated.transactionId) {
      await this.transactionsRepository.update(updated.transactionId, {
        description: updated.description,
        type: updated.type,
        amount: updated.amount,
        categoryId: updated.categoryId,
        accountId: updated.accountId,
      });
    }

    return this.withOverdue(updated);
  }

  async remove(id: string, userId: string): Promise<void> {
    const entry = await this.monthlyEntriesRepository.findOwnedById(id, userId);
    if (!entry) {
      throw new NotFoundException(ENTRY_NOT_FOUND_ERROR);
    }

    if (entry.recurrenceId) {
      throw new ConflictException(CANNOT_DELETE_RECURRENCE_LINKED_ERROR);
    }

    if (entry.transactionId) {
      throw new ConflictException(CANNOT_DELETE_SETTLED_ERROR);
    }

    await this.monthlyEntriesRepository.deleteById(id);
  }

  async settle(
    id: string,
    userId: string,
    dto: SettleMonthlyEntryDto,
  ): Promise<MonthlyEntryResponse> {
    const entry = await this.monthlyEntriesRepository.findOwnedById(id, userId);
    if (!entry) {
      throw new NotFoundException(ENTRY_NOT_FOUND_ERROR);
    }

    if (entry.status !== 'pendente') {
      throw new ConflictException(ALREADY_SETTLED_OR_SKIPPED_ERROR);
    }

    const transaction = await this.transactionsRepository.create({
      userId,
      categoryId: entry.categoryId,
      accountId: entry.accountId,
      description: entry.description,
      type: entry.type,
      amount: entry.amount,
      settledAt: dto.settledAt ?? new Date(),
    });

    const updated = await this.monthlyEntriesRepository.markAsSettled(
      id,
      transaction.id,
    );
    return this.withOverdue(updated);
  }

  async unsettle(id: string, userId: string): Promise<MonthlyEntryResponse> {
    const entry = await this.monthlyEntriesRepository.findOwnedById(id, userId);
    if (!entry) {
      throw new NotFoundException(ENTRY_NOT_FOUND_ERROR);
    }

    if (entry.status !== 'liquidado' || !entry.transactionId) {
      throw new ConflictException(NOT_SETTLED_ERROR);
    }

    const transactionId = entry.transactionId;
    const updated = await this.db.transaction(async (tx) => {
      // A FK de monthly_entries.transaction_id precisa ser limpa antes de
      // apagar a transaction, senão a constraint bloqueia o delete.
      const result = await this.monthlyEntriesRepository.markAsUnsettled(id, tx);
      await this.transactionsRepository.deleteById(transactionId, tx);
      return result;
    });

    return this.withOverdue(updated);
  }

  async skip(id: string, userId: string): Promise<MonthlyEntryResponse> {
    const entry = await this.monthlyEntriesRepository.findOwnedById(id, userId);
    if (!entry) {
      throw new NotFoundException(ENTRY_NOT_FOUND_ERROR);
    }

    if (!entry.recurrenceId) {
      throw new BadRequestException(ONLY_RECURRENCE_LINKED_CAN_BE_SKIPPED_ERROR);
    }

    if (entry.status !== 'pendente') {
      throw new ConflictException(NOT_PENDING_ERROR);
    }

    const updated = await this.monthlyEntriesRepository.markAsSkipped(id);
    return this.withOverdue(updated);
  }

  async unskip(id: string, userId: string): Promise<MonthlyEntryResponse> {
    const entry = await this.monthlyEntriesRepository.findOwnedById(id, userId);
    if (!entry) {
      throw new NotFoundException(ENTRY_NOT_FOUND_ERROR);
    }

    if (entry.status !== 'pulado') {
      throw new ConflictException(NOT_SKIPPED_ERROR);
    }

    const updated = await this.monthlyEntriesRepository.markAsUnskipped(id);
    return this.withOverdue(updated);
  }

  private async generateForPeriod(
    userId: string,
    month: number,
    year: number,
  ): Promise<void> {
    const periodEnd = new Date(year, month, 1);
    const eligibleRecurrences = await this.recurrencesRepository.findEligibleForPeriod(
      userId,
      periodEnd,
    );

    if (eligibleRecurrences.length === 0) {
      return;
    }

    await this.db.transaction(async (tx) => {
      for (const recurrence of eligibleRecurrences) {
        const dueDate = this.clampDueDate(year, month, recurrence.dueDay);
        const installmentNumber = recurrence.installmentsTotal
          ? recurrence.installmentsGenerated + 1
          : null;

        const created = await this.monthlyEntriesRepository.create(
          {
            userId,
            recurrenceId: recurrence.id,
            categoryId: recurrence.categoryId,
            accountId: recurrence.accountId,
            description: recurrence.description,
            type: recurrence.type,
            amount: recurrence.defaultAmount,
            dueDate,
            month,
            year,
            installmentNumber,
          },
          tx,
        );

        if (created && recurrence.installmentsTotal) {
          const installmentsGenerated = recurrence.installmentsGenerated + 1;
          const shouldDeactivate =
            installmentsGenerated >= recurrence.installmentsTotal;

          await this.recurrencesRepository.update(
            recurrence.id,
            {
              installmentsGenerated,
              ...(shouldDeactivate ? { active: false } : {}),
            },
            tx,
          );
        }
      }
    });
  }

  private async buildPreview(
    userId: string,
    month: number,
    year: number,
  ): Promise<(MonthlyEntryResponse | MonthlyEntryPreview)[]> {
    const realEntries = await this.monthlyEntriesRepository.findAllByUserAndPeriod(
      userId,
      month,
      year,
    );
    const realEntriesWithOverdue = realEntries.map((entry) =>
      this.withOverdue(entry),
    );

    const periodEnd = new Date(year, month, 1);
    const eligibleRecurrences = await this.recurrencesRepository.findEligibleForPeriod(
      userId,
      periodEnd,
    );

    const now = new Date();
    const monthsAhead =
      (year - now.getFullYear()) * 12 + (month - (now.getMonth() + 1));

    const previewEntries: MonthlyEntryPreview[] = [];
    for (const recurrence of eligibleRecurrences) {
      let installmentNumber: number | null = null;
      if (recurrence.installmentsTotal) {
        installmentNumber = recurrence.installmentsGenerated + monthsAhead;
        if (installmentNumber > recurrence.installmentsTotal) {
          continue;
        }
      }

      previewEntries.push({
        id: null,
        recurrenceId: recurrence.id,
        categoryId: recurrence.categoryId,
        accountId: recurrence.accountId,
        description: recurrence.description,
        type: recurrence.type,
        amount: recurrence.defaultAmount,
        dueDate: this.clampDueDate(year, month, recurrence.dueDay),
        month,
        year,
        installmentNumber,
        isOverdue: false,
      });
    }

    return [...realEntriesWithOverdue, ...previewEntries];
  }

  private isFuturePeriod(month: number, year: number): boolean {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    return year > currentYear || (year === currentYear && month > currentMonth);
  }

  /**
   * Datas de vencimento são tratadas como strings ISO puras (`YYYY-MM-DD`)
   * do início ao fim, nunca como `Date`/timestamp: um `due_date` não tem
   * horário nem timezone, e converter para `Date` e de volta introduziria
   * deslocamento de fuso (ex: meia-noite local vira outro dia em UTC).
   */
  private clampDueDate(year: number, month: number, dueDay: number): string {
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = Math.min(dueDay, lastDayOfMonth);
    return this.formatDate(year, month, day);
  }

  private parseDateParts(dateStr: string): { year: number; month: number } {
    return {
      year: Number(dateStr.slice(0, 4)),
      month: Number(dateStr.slice(5, 7)),
    };
  }

  private formatDate(year: number, month: number, day: number): string {
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private todayAsDateString(): string {
    const now = new Date();
    return this.formatDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  private withOverdue(entry: MonthlyEntry): MonthlyEntryResponse {
    const isOverdue =
      entry.status === 'pendente' && entry.dueDate < this.todayAsDateString();
    return { ...entry, isOverdue };
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

  private async assertAccountOwnership(
    accountId: string,
    userId: string,
  ): Promise<void> {
    const account = await this.accountsRepository.findOwnedById(
      accountId,
      userId,
    );
    if (!account) {
      throw new NotFoundException(ACCOUNT_NOT_FOUND_ERROR);
    }
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { TransactionsRepository } from '../../transactions/transactions.repository.js';
import { AccountsRepository } from '../accounts.repository.js';
import type { Account } from '../../../database/schema/accounts.schema.js';
import type { CreateAccountDto } from '../dto/create-account.dto.js';
import type { UpdateAccountDto } from '../dto/update-account.dto.js';

const NOT_FOUND_ERROR = 'Conta não encontrada';

export interface AccountResponse extends Account {
  currentBalance: number;
}

@Injectable()
export class AccountsService {
  constructor(
    private readonly accountsRepository: AccountsRepository,
    private readonly transactionsRepository: TransactionsRepository,
  ) {}

  async create(userId: string, dto: CreateAccountDto): Promise<AccountResponse> {
    const account = await this.accountsRepository.create({
      userId,
      name: dto.name,
      initialBalance: dto.initialBalance ?? 0,
    });

    return { ...account, currentBalance: account.initialBalance };
  }

  async findAll(userId: string): Promise<AccountResponse[]> {
    const [accounts, deltas] = await Promise.all([
      this.accountsRepository.findAllByUser(userId),
      this.transactionsRepository.getBalanceDeltasByUser(userId),
    ]);

    const deltaByAccountId = new Map(
      deltas.map((delta) => [delta.accountId, delta.delta]),
    );

    return accounts.map((account) => ({
      ...account,
      currentBalance:
        account.initialBalance + (deltaByAccountId.get(account.id) ?? 0),
    }));
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateAccountDto,
  ): Promise<AccountResponse> {
    const account = await this.accountsRepository.findOwnedById(id, userId);
    if (!account) {
      throw new NotFoundException(NOT_FOUND_ERROR);
    }

    const updated = await this.accountsRepository.update(id, dto);
    const deltas = await this.transactionsRepository.getBalanceDeltasByUser(
      userId,
    );
    const delta = deltas.find((item) => item.accountId === id)?.delta ?? 0;

    return { ...updated, currentBalance: updated.initialBalance + delta };
  }

  async remove(id: string, userId: string): Promise<void> {
    const account = await this.accountsRepository.findOwnedById(id, userId);
    if (!account) {
      throw new NotFoundException(NOT_FOUND_ERROR);
    }

    await this.accountsRepository.softDelete(id);
  }
}

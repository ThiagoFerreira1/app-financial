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
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard.js';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe.js';
import {
  AccountsService,
  type AccountResponse,
} from '../service/accounts.service.js';
import {
  createAccountSchema,
  type CreateAccountDto,
} from '../dto/create-account.dto.js';
import {
  updateAccountSchema,
  type UpdateAccountDto,
} from '../dto/update-account.dto.js';

@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  create(
    @CurrentUser() user: { sub: string } | undefined,
    @Body(new ZodValidationPipe(createAccountSchema)) dto: CreateAccountDto,
  ): Promise<AccountResponse> {
    return this.accountsService.create(user!.sub, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: { sub: string } | undefined,
  ): Promise<AccountResponse[]> {
    return this.accountsService.findAll(user!.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string } | undefined,
    @Body(new ZodValidationPipe(updateAccountSchema)) dto: UpdateAccountDto,
  ): Promise<AccountResponse> {
    return this.accountsService.update(id, user!.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string } | undefined,
  ): Promise<null> {
    await this.accountsService.remove(id, user!.sub);
    return null;
  }
}

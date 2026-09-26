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
import {
  MonthlyEntriesService,
  type MonthlyEntryPreview,
  type MonthlyEntryResponse,
} from '../service/monthly-entries.service.js';
import {
  createMonthlyEntrySchema,
  type CreateMonthlyEntryDto,
} from '../dto/create-monthly-entry.dto.js';
import {
  updateMonthlyEntrySchema,
  type UpdateMonthlyEntryDto,
} from '../dto/update-monthly-entry.dto.js';
import {
  findMonthlyEntriesQuerySchema,
  type FindMonthlyEntriesQueryDto,
} from '../dto/find-monthly-entries-query.dto.js';
import {
  settleMonthlyEntrySchema,
  type SettleMonthlyEntryDto,
} from '../dto/settle-monthly-entry.dto.js';

@Controller('monthly-entries')
@UseGuards(JwtAuthGuard)
export class MonthlyEntriesController {
  constructor(private readonly monthlyEntriesService: MonthlyEntriesService) {}

  @Get()
  findAll(
    @CurrentUser() user: { sub: string } | undefined,
    @Query(new ZodValidationPipe(findMonthlyEntriesQuerySchema))
    query: FindMonthlyEntriesQueryDto,
  ): Promise<(MonthlyEntryResponse | MonthlyEntryPreview)[]> {
    return this.monthlyEntriesService.findAllForPeriod(
      user!.sub,
      query.month,
      query.year,
    );
  }

  @Post()
  create(
    @CurrentUser() user: { sub: string } | undefined,
    @Body(new ZodValidationPipe(createMonthlyEntrySchema))
    dto: CreateMonthlyEntryDto,
  ): Promise<MonthlyEntryResponse> {
    return this.monthlyEntriesService.create(user!.sub, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string } | undefined,
    @Body(new ZodValidationPipe(updateMonthlyEntrySchema))
    dto: UpdateMonthlyEntryDto,
  ): Promise<MonthlyEntryResponse> {
    return this.monthlyEntriesService.update(id, user!.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string } | undefined,
  ): Promise<null> {
    await this.monthlyEntriesService.remove(id, user!.sub);
    return null;
  }

  @Post(':id/settle')
  @HttpCode(HttpStatus.OK)
  settle(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string } | undefined,
    @Body(new ZodValidationPipe(settleMonthlyEntrySchema))
    dto: SettleMonthlyEntryDto,
  ): Promise<MonthlyEntryResponse> {
    return this.monthlyEntriesService.settle(id, user!.sub, dto);
  }

  @Post(':id/unsettle')
  @HttpCode(HttpStatus.OK)
  unsettle(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string } | undefined,
  ): Promise<MonthlyEntryResponse> {
    return this.monthlyEntriesService.unsettle(id, user!.sub);
  }

  @Post(':id/skip')
  @HttpCode(HttpStatus.OK)
  skip(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string } | undefined,
  ): Promise<MonthlyEntryResponse> {
    return this.monthlyEntriesService.skip(id, user!.sub);
  }

  @Post(':id/unskip')
  @HttpCode(HttpStatus.OK)
  unskip(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string } | undefined,
  ): Promise<MonthlyEntryResponse> {
    return this.monthlyEntriesService.unskip(id, user!.sub);
  }
}

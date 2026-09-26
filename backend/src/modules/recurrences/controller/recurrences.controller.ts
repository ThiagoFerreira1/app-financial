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
import { RecurrencesService } from '../service/recurrences.service.js';
import type { Recurrence } from '../../../database/schema/recurrences.schema.js';
import {
  createRecurrenceSchema,
  type CreateRecurrenceDto,
} from '../dto/create-recurrence.dto.js';
import {
  updateRecurrenceSchema,
  type UpdateRecurrenceDto,
} from '../dto/update-recurrence.dto.js';
import {
  findRecurrencesQuerySchema,
  type FindRecurrencesQueryDto,
} from '../dto/find-recurrences-query.dto.js';

@Controller('recurrences')
@UseGuards(JwtAuthGuard)
export class RecurrencesController {
  constructor(private readonly recurrencesService: RecurrencesService) {}

  @Post()
  create(
    @CurrentUser() user: { sub: string } | undefined,
    @Body(new ZodValidationPipe(createRecurrenceSchema))
    dto: CreateRecurrenceDto,
  ): Promise<Recurrence> {
    return this.recurrencesService.create(user!.sub, dto);
  }

  @Get()
  findAll(
    @CurrentUser() user: { sub: string } | undefined,
    @Query(new ZodValidationPipe(findRecurrencesQuerySchema))
    query: FindRecurrencesQueryDto,
  ): Promise<Recurrence[]> {
    return this.recurrencesService.findAll(user!.sub, query);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string } | undefined,
    @Body(new ZodValidationPipe(updateRecurrenceSchema))
    dto: UpdateRecurrenceDto,
  ): Promise<Recurrence> {
    return this.recurrencesService.update(id, user!.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string } | undefined,
  ): Promise<null> {
    await this.recurrencesService.remove(id, user!.sub);
    return null;
  }
}

import { z } from 'zod';

export const findMonthlyEntriesQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(1),
});

export type FindMonthlyEntriesQueryDto = z.infer<
  typeof findMonthlyEntriesQuerySchema
>;

import { z } from 'zod';

const booleanQueryParam = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const findRecurrencesQuerySchema = z.object({
  active: booleanQueryParam.optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
});

export type FindRecurrencesQueryDto = z.infer<typeof findRecurrencesQuerySchema>;

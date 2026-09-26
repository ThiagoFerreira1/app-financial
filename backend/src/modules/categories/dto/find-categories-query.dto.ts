import { z } from 'zod';

export const findCategoriesQuerySchema = z.object({
  name: z.string().min(3).optional(),
});

export type FindCategoriesQueryDto = z.infer<typeof findCategoriesQuerySchema>;

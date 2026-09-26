import { z } from 'zod';

export const createRecurrenceSchema = z.object({
  description: z.string().min(1),
  categoryId: z.string().uuid(),
  type: z.enum(['despesa', 'receita']),
  defaultAmount: z.number().int().positive(),
  dueDay: z.number().int().min(1).max(31),
  installmentsTotal: z.number().int().min(1).optional(),
});

export type CreateRecurrenceDto = z.infer<typeof createRecurrenceSchema>;

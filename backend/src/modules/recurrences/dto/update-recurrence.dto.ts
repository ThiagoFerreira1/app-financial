import { z } from 'zod';

export const updateRecurrenceSchema = z.object({
  description: z.string().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  type: z.enum(['despesa', 'receita']).optional(),
  defaultAmount: z.number().int().positive().optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  active: z.boolean().optional(),
  installmentsTotal: z.number().int().min(1).optional(),
});

export type UpdateRecurrenceDto = z.infer<typeof updateRecurrenceSchema>;

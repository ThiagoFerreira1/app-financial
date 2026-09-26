import { z } from 'zod';

export const updateMonthlyEntrySchema = z.object({
  description: z.string().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  type: z.enum(['despesa', 'receita']).optional(),
  amount: z.number().int().positive().optional(),
  dueDate: z.iso.date().optional(),
});

export type UpdateMonthlyEntryDto = z.infer<typeof updateMonthlyEntrySchema>;

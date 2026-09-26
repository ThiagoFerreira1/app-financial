import { z } from 'zod';

export const createMonthlyEntrySchema = z.object({
  description: z.string().min(1),
  categoryId: z.string().uuid(),
  accountId: z.string().uuid(),
  type: z.enum(['despesa', 'receita']),
  amount: z.number().int().positive(),
  dueDate: z.iso.date(),
});

export type CreateMonthlyEntryDto = z.infer<typeof createMonthlyEntrySchema>;

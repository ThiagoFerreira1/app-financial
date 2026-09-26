import { z } from 'zod';

export const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  initialBalance: z.number().int().optional(),
});

export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;

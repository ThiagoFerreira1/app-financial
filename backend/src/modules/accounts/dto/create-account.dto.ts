import { z } from 'zod';

export const createAccountSchema = z.object({
  name: z.string().min(1),
  initialBalance: z.number().int().optional(),
});

export type CreateAccountDto = z.infer<typeof createAccountSchema>;

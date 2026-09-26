import { z } from 'zod';

export const settleMonthlyEntrySchema = z.object({
  settledAt: z.coerce.date().optional(),
});

export type SettleMonthlyEntryDto = z.infer<typeof settleMonthlyEntrySchema>;

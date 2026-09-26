ALTER TABLE "transactions" RENAME COLUMN "paid_at" TO "settled_at";
--> statement-breakpoint
ALTER TABLE "monthly_entries" DROP CONSTRAINT "monthly_entries_status_check";
--> statement-breakpoint
UPDATE "monthly_entries" SET "status" = 'liquidado' WHERE "status" = 'pago';
--> statement-breakpoint
ALTER TABLE "monthly_entries" ADD CONSTRAINT "monthly_entries_status_check" CHECK ("monthly_entries"."status" IN ('pendente', 'liquidado', 'pulado'));

ALTER TABLE "recurrences" ADD COLUMN "installments_total" integer;--> statement-breakpoint
ALTER TABLE "recurrences" ADD COLUMN "installments_generated" integer DEFAULT 0 NOT NULL;
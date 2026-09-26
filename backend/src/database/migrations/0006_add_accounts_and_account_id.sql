CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"initial_balance" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recurrences" ADD COLUMN "account_id" uuid;
--> statement-breakpoint
ALTER TABLE "monthly_entries" ADD COLUMN "account_id" uuid;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "account_id" uuid;
--> statement-breakpoint
INSERT INTO "accounts" ("id", "user_id", "name", "initial_balance")
SELECT gen_random_uuid(), "id", 'Conta Padrão', 0 FROM "users";
--> statement-breakpoint
UPDATE "recurrences" SET "account_id" = "accounts"."id"
FROM "accounts"
WHERE "accounts"."user_id" = "recurrences"."user_id" AND "accounts"."name" = 'Conta Padrão';
--> statement-breakpoint
UPDATE "monthly_entries" SET "account_id" = "accounts"."id"
FROM "accounts"
WHERE "accounts"."user_id" = "monthly_entries"."user_id" AND "accounts"."name" = 'Conta Padrão';
--> statement-breakpoint
UPDATE "transactions" SET "account_id" = "accounts"."id"
FROM "accounts"
WHERE "accounts"."user_id" = "transactions"."user_id" AND "accounts"."name" = 'Conta Padrão';
--> statement-breakpoint
ALTER TABLE "recurrences" ALTER COLUMN "account_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "monthly_entries" ALTER COLUMN "account_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "account_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "monthly_entries" ADD CONSTRAINT "monthly_entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;

CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"paid_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_type_check" CHECK ("transactions"."type" IN ('despesa', 'receita'))
);
--> statement-breakpoint
CREATE TABLE "monthly_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"recurrence_id" uuid,
	"category_id" uuid NOT NULL,
	"transaction_id" uuid,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"installment_number" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_entries_type_check" CHECK ("monthly_entries"."type" IN ('despesa', 'receita')),
	CONSTRAINT "monthly_entries_status_check" CHECK ("monthly_entries"."status" IN ('pendente', 'pago', 'pulado'))
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_entries" ADD CONSTRAINT "monthly_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_entries" ADD CONSTRAINT "monthly_entries_recurrence_id_recurrences_id_fk" FOREIGN KEY ("recurrence_id") REFERENCES "public"."recurrences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_entries" ADD CONSTRAINT "monthly_entries_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_entries" ADD CONSTRAINT "monthly_entries_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_entries_recurrence_id_month_year_unique" ON "monthly_entries" USING btree ("recurrence_id","month","year") WHERE "monthly_entries"."recurrence_id" is not null;
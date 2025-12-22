CREATE TABLE "processed_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" text NOT NULL,
	"thread_id" text,
	"user_id" text NOT NULL,
	"from" text NOT NULL,
	"subject" text,
	"snippet" text,
	"is_meeting_request" boolean DEFAULT false NOT NULL,
	"availability_status" text DEFAULT 'unknown' NOT NULL,
	"draft_id" text,
	"draft_body" text,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"calendly_url" text,
	"working_hours_start" integer DEFAULT 9,
	"working_hours_end" integer DEFAULT 17,
	"timezone" text DEFAULT 'UTC',
	"calendar_enabled" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "processed_emails_user_id_idx" ON "processed_emails" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "processed_emails_message_user_idx" ON "processed_emails" USING btree ("message_id","user_id");--> statement-breakpoint
CREATE INDEX "processed_emails_processed_at_idx" ON "processed_emails" USING btree ("processed_at");
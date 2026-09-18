CREATE TABLE "generation_usage" (
	"day" date NOT NULL,
	"scope" varchar(16) NOT NULL,
	"key" varchar(64) NOT NULL,
	"attempts" integer NOT NULL,
	"last_attempt_at" timestamp with time zone,
	CONSTRAINT "generation_usage_day_scope_key_pk" PRIMARY KEY("day","scope","key")
);
--> statement-breakpoint
CREATE TABLE "public_sounds" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"thought" varchar(240) NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "public_sounds_created_at_id_idx" ON "public_sounds" USING btree ("created_at" DESC NULLS LAST,"id" DESC NULLS LAST);
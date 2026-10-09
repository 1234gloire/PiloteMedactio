CREATE TABLE "email_templates" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "email_templates_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" varchar(160) NOT NULL,
	"category" varchar(32) DEFAULT 'General' NOT NULL,
	"subject" varchar(240) NOT NULL,
	"body" text NOT NULL,
	"createdBy" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_createdBy_internal_users_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."internal_users"("id") ON DELETE set null ON UPDATE no action;
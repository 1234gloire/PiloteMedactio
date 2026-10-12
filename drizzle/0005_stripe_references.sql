ALTER TABLE "invoices" ADD COLUMN "stripeInvoiceId" varchar(80);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "stripeCustomerId" varchar(80);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "stripeSubscriptionId" varchar(80);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_stripeInvoiceId_unique" UNIQUE("stripeInvoiceId");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_stripeSubscriptionId_unique" UNIQUE("stripeSubscriptionId");
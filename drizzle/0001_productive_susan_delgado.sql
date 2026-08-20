ALTER TABLE "orders" ADD COLUMN "shippingAddress" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shippingCity" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shippingState" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "subtotal" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deliveryFee" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deliveryMethod" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paymentMethod" text NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paymentStatus" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "orderStatus" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paymentReference" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "updatedAt" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "status";
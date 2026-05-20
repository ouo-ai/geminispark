CREATE TYPE "BillingInterval" AS ENUM ('MONTH', 'YEAR');

ALTER TABLE "UserCredit" ADD COLUMN "billingInterval" "BillingInterval";

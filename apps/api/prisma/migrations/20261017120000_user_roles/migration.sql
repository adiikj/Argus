-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'analyst', 'viewer');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'analyst';

-- existing installs: the earliest account is the one that bootstrapped the
-- instance (first registration flipped the login gate on), so it becomes admin
UPDATE "users" SET "role" = 'admin'
WHERE "user_id" = (SELECT "user_id" FROM "users" ORDER BY "created_at" ASC LIMIT 1);

-- AlterEnum
BEGIN;
CREATE TYPE "IncidentStatus_new" AS ENUM ('open', 'acknowledged', 'resolved', 'false_positive');
ALTER TABLE "public"."incidents" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "incidents" ALTER COLUMN "status" TYPE "IncidentStatus_new" USING ("status"::text::"IncidentStatus_new");
ALTER TYPE "IncidentStatus" RENAME TO "IncidentStatus_old";
ALTER TYPE "IncidentStatus_new" RENAME TO "IncidentStatus";
DROP TYPE "public"."IncidentStatus_old";
ALTER TABLE "incidents" ALTER COLUMN "status" SET DEFAULT 'open';
COMMIT;

-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "assignee_id" TEXT,
ADD COLUMN     "resolution_note" TEXT;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

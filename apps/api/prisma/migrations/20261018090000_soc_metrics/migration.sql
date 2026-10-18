-- AlterTable
ALTER TABLE "incidents" ADD COLUMN     "acknowledged_at" TIMESTAMP(3),
ADD COLUMN     "closed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "first_seen_at" TIMESTAMP(3);

-- existing incidents: the last update is the best available guess for when a
-- triaged incident was touched, so backfill from it rather than leave every
-- historical incident out of MTTA / MTTR
UPDATE "incidents" SET "acknowledged_at" = "updated_at" WHERE "status" <> 'open';
UPDATE "incidents" SET "closed_at" = "updated_at"
WHERE "status" IN ('resolved', 'false_positive');

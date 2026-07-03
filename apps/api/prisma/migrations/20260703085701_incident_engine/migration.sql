-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('info', 'low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "Summarizer" AS ENUM ('llm', 'template');

-- CreateTable
CREATE TABLE "incidents" (
    "incident_id" TEXT NOT NULL,
    "correlation_key" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "alert_ids" TEXT[],
    "event_ids" TEXT[],

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("incident_id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "alert_id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "entity" TEXT NOT NULL,
    "event_ids" TEXT[],
    "message" TEXT NOT NULL,
    "count" INTEGER,
    "incident_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("alert_id")
);

-- CreateTable
CREATE TABLE "summaries" (
    "incident_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "iocs" TEXT[],
    "recommended_actions" TEXT[],
    "generated_by" "Summarizer" NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "summaries_pkey" PRIMARY KEY ("incident_id")
);

-- CreateIndex
CREATE INDEX "incidents_correlation_key_status_updated_at_idx" ON "incidents"("correlation_key", "status", "updated_at");

-- CreateIndex
CREATE INDEX "alerts_incident_id_idx" ON "alerts"("incident_id");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("incident_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("incident_id") ON DELETE RESTRICT ON UPDATE CASCADE;

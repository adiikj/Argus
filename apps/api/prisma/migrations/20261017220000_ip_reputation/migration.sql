-- CreateTable
CREATE TABLE "ip_reputation" (
    "ip" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "abuse_score" INTEGER NOT NULL,
    "total_reports" INTEGER NOT NULL,
    "distinct_reporters" INTEGER NOT NULL,
    "is_tor" BOOLEAN NOT NULL,
    "usage_type" TEXT,
    "isp" TEXT,
    "domain" TEXT,
    "country_code" TEXT,
    "last_reported_at" TIMESTAMP(3),
    "checked_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ip_reputation_pkey" PRIMARY KEY ("ip")
);


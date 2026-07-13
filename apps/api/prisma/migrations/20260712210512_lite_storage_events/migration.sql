-- CreateTable
CREATE TABLE "normalized_events" (
    "event_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "source_ip" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "username" TEXT,
    "method" TEXT,
    "path" TEXT,
    "status_code" INTEGER,
    "user_agent" TEXT,
    "raw" TEXT NOT NULL,

    CONSTRAINT "normalized_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "normalized_events_timestamp_idx" ON "normalized_events"("timestamp");

-- CreateIndex
CREATE INDEX "normalized_events_source_idx" ON "normalized_events"("source");

-- CreateIndex
-- functional GIN index for the STORAGE_PROFILE=lite fallback search; 'simple'
-- (no stemming) suits IPs/usernames/paths better than 'english'. Not
-- representable in schema.prisma (no functional-index syntax), so it's
-- hand-written here — the query side must use the identical expression for
-- Postgres to use this index (see postgres-events.ts). `||`/`coalesce` only,
-- not `concat_ws` — concat_ws is STABLE, not IMMUTABLE, and Postgres refuses
-- non-immutable functions in an index expression.
CREATE INDEX "normalized_events_fts_idx" ON "normalized_events"
  USING GIN (to_tsvector('simple'::regconfig,
    raw || ' ' || source_ip || ' ' || coalesce(username, '') || ' ' || coalesce(path, '') || ' ' || coalesce(user_agent, '')));

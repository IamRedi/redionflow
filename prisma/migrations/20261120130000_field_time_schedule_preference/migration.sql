-- Additive preference only; recorded sessions, pauses and grants are untouched.
ALTER TABLE "Worker" ADD COLUMN "fieldTimeScheduled" BOOLEAN NOT NULL DEFAULT false;

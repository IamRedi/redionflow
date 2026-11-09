-- AI assistant access per person. Additive: every existing company keeps
-- open access until assistantAccessSelected is switched on for it.
ALTER TABLE "CompanyProfile" ADD COLUMN "assistantAccessSelected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "assistantAccess" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Worker" ADD COLUMN "assistantAccess" BOOLEAN NOT NULL DEFAULT false;

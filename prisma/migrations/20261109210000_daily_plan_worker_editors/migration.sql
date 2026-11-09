-- People with "Vepron" on the daily plan (key button) may create and save it.
ALTER TABLE "DailyWorkPlan" ALTER COLUMN "createdByAdminId" DROP NOT NULL;
ALTER TABLE "DailyWorkPlanSnapshot" ALTER COLUMN "createdByAdminId" DROP NOT NULL;

-- Metal construction (Stahlbau) site types: workshop fabrication and on-site assembly.
ALTER TYPE "BaustelleType" ADD VALUE IF NOT EXISTS 'STEEL_WORKSHOP';
ALTER TYPE "BaustelleType" ADD VALUE IF NOT EXISTS 'STEEL_ASSEMBLY';

-- Company logo shown in the top bar, stored as a small data: URL (max ~200 KB).
ALTER TABLE "CompanyProfile" ADD COLUMN "logoDataUrl" TEXT;

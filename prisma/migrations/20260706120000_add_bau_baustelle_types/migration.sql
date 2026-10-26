-- Add Bau (construction) BaustelleType enum values so BauFlow tenants
-- can classify baustellen without borrowing tree-work categories.

ALTER TYPE "BaustelleType" ADD VALUE IF NOT EXISTS 'SIGNAGE';
ALTER TYPE "BaustelleType" ADD VALUE IF NOT EXISTS 'DRAINAGE';
ALTER TYPE "BaustelleType" ADD VALUE IF NOT EXISTS 'WALL';
ALTER TYPE "BaustelleType" ADD VALUE IF NOT EXISTS 'PAVING';
ALTER TYPE "BaustelleType" ADD VALUE IF NOT EXISTS 'PAINTING';
ALTER TYPE "BaustelleType" ADD VALUE IF NOT EXISTS 'RENOVATION';
ALTER TYPE "BaustelleType" ADD VALUE IF NOT EXISTS 'OTHER';

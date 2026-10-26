-- AlterEnum
ALTER TYPE "AssistantLanguage" ADD VALUE 'PL';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "motherTongue" "AssistantLanguage" NOT NULL DEFAULT 'DE';

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "motherTongue" "AssistantLanguage" NOT NULL DEFAULT 'DE';

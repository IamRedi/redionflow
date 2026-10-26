-- AlterTable
ALTER TABLE "Machine" ADD COLUMN     "huStatus" TEXT,
ADD COLUMN     "spDate" TIMESTAMP(3),
ADD COLUMN     "spStatus" TEXT,
ADD COLUMN     "uvvDate" TIMESTAMP(3),
ADD COLUMN     "uvvStatus" TEXT;

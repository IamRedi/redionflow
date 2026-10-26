-- CreateEnum
CREATE TYPE "BaustelleType" AS ENUM ('TRUCK_PLATFORM', 'TRUCK_CRANE', 'CLIMBING', 'WATERING', 'EXCAVATOR');

-- AlterTable
ALTER TABLE "Baustelle" ADD COLUMN     "type" "BaustelleType" NOT NULL DEFAULT 'CLIMBING';

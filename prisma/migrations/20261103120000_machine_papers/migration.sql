-- Albanian vehicle papers on machines (all optional).
ALTER TABLE "Machine" ADD COLUMN "insuranceDate" TIMESTAMP(3);
ALTER TABLE "Machine" ADD COLUMN "taxDate" TIMESTAMP(3);
ALTER TABLE "Machine" ADD COLUMN "transportPermitDate" TIMESTAMP(3);
ALTER TABLE "Machine" ADD COLUMN "tachographDate" TIMESTAMP(3);
ALTER TABLE "Machine" ADD COLUMN "ownership" TEXT;
ALTER TABLE "Machine" ADD COLUMN "tonnage" DOUBLE PRECISION;
